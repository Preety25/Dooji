"""GenerationPolicy — authoritative anonymous quota + global provider budget.

Cache hits never reach this layer. Only provider-bound cache misses do.

Local/dev: InMemoryGenerationPolicy (process memory).
Default production-shaped local: FileGenerationPolicy (durable shared file).
Swap implementations without changing Canvas / Preview / Result / Library.
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Protocol


WINDOW_SECONDS = 24 * 60 * 60
DEFAULT_ANON_LIMIT = 6
DEFAULT_GLOBAL_DAILY = 500

AuditKind = Literal[
    "provider_attempt",
    "successful_generation",
    "provider_failure",
    "cache_hit",
    "rate_limited",
    "global_budget_blocked",
]


@dataclass
class AuditEvent:
    kind: AuditKind
    client_id: str | None = None
    ip: str | None = None
    style: str | None = None
    at: float = field(default_factory=time.time)
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "client_id": self.client_id,
            "ip": self.ip,
            "style": self.style,
            "at": self.at,
            "detail": self.detail,
        }


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str = "ok"
    remaining: int | None = None
    reset_at: float | None = None
    message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "remaining": self.remaining,
            "reset_at": self.reset_at,
            "message": self.message,
        }


class GenerationPolicy(Protocol):
    """Server-authoritative generation gate. Mobile never overrides this."""

    def check(
        self,
        *,
        client_id: str,
        ip: str | None = None,
    ) -> PolicyDecision: ...

    def record_provider_attempt(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None: ...

    def record_success(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None: ...

    def record_failure(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
        error: str | None = None,
    ) -> None: ...

    def record_cache_hit(
        self,
        *,
        client_id: str | None = None,
        style: str | None = None,
    ) -> None: ...

    def audit_log(self) -> list[dict[str, Any]]: ...


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _prune(ts: list[float], now: float, window: float) -> list[float]:
    cutoff = now - window
    return [t for t in ts if t > cutoff]


class InMemoryGenerationPolicy:
    """Dev/mock: process-local. NOT production-durable."""

    def __init__(
        self,
        *,
        anon_limit: int | None = None,
        global_daily: int | None = None,
        window_seconds: float = WINDOW_SECONDS,
        ip_burst_limit: int = 30,
    ) -> None:
        self.anon_limit = anon_limit if anon_limit is not None else _env_int(
            "DOOJI_ANON_GENERATION_LIMIT", DEFAULT_ANON_LIMIT
        )
        self.global_daily = global_daily if global_daily is not None else _env_int(
            "DOOJI_GLOBAL_DAILY_BUDGET", DEFAULT_GLOBAL_DAILY
        )
        self.window = window_seconds
        self.ip_burst_limit = ip_burst_limit
        self._lock = threading.Lock()
        self._client_attempts: dict[str, list[float]] = {}
        self._ip_attempts: dict[str, list[float]] = {}
        self._global_attempts: list[float] = []
        self._audit: list[AuditEvent] = []

    def check(self, *, client_id: str, ip: str | None = None) -> PolicyDecision:
        now = time.time()
        with self._lock:
            client_ts = _prune(self._client_attempts.get(client_id, []), now, self.window)
            global_ts = _prune(self._global_attempts, now, self.window)
            ip_ts = (
                _prune(self._ip_attempts.get(ip, []), now, self.window) if ip else []
            )

            if len(global_ts) >= self.global_daily:
                reset_at = min(global_ts) + self.window if global_ts else now + self.window
                self._audit.append(
                    AuditEvent(kind="global_budget_blocked", client_id=client_id, ip=ip)
                )
                return PolicyDecision(
                    allowed=False,
                    reason="global_budget_blocked",
                    remaining=0,
                    reset_at=reset_at,
                    message="You've reached your generation limit for now. Try again later.",
                )

            if ip and len(ip_ts) >= self.ip_burst_limit:
                reset_at = min(ip_ts) + self.window
                self._audit.append(
                    AuditEvent(kind="rate_limited", client_id=client_id, ip=ip, detail={"scope": "ip"})
                )
                return PolicyDecision(
                    allowed=False,
                    reason="rate_limited",
                    remaining=0,
                    reset_at=reset_at,
                    message="You've reached your generation limit for now. Try again later.",
                )

            used = len(client_ts)
            remaining = max(0, self.anon_limit - used)
            if used >= self.anon_limit:
                reset_at = min(client_ts) + self.window if client_ts else now + self.window
                self._audit.append(
                    AuditEvent(kind="rate_limited", client_id=client_id, ip=ip)
                )
                return PolicyDecision(
                    allowed=False,
                    reason="rate_limited",
                    remaining=0,
                    reset_at=reset_at,
                    message="You've reached your generation limit for now. Try again later.",
                )

            reset_at = (
                min(client_ts) + self.window if client_ts else now + self.window
            )
            return PolicyDecision(
                allowed=True,
                reason="ok",
                remaining=remaining,
                reset_at=reset_at,
            )

    def record_provider_attempt(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None:
        now = time.time()
        with self._lock:
            self._client_attempts.setdefault(client_id, []).append(now)
            self._client_attempts[client_id] = _prune(
                self._client_attempts[client_id], now, self.window
            )
            self._global_attempts.append(now)
            self._global_attempts = _prune(self._global_attempts, now, self.window)
            if ip:
                self._ip_attempts.setdefault(ip, []).append(now)
                self._ip_attempts[ip] = _prune(self._ip_attempts[ip], now, self.window)
            self._audit.append(
                AuditEvent(
                    kind="provider_attempt",
                    client_id=client_id,
                    ip=ip,
                    style=style,
                    at=now,
                )
            )

    def record_success(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None:
        with self._lock:
            self._audit.append(
                AuditEvent(
                    kind="successful_generation",
                    client_id=client_id,
                    ip=ip,
                    style=style,
                )
            )

    def record_failure(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            self._audit.append(
                AuditEvent(
                    kind="provider_failure",
                    client_id=client_id,
                    ip=ip,
                    style=style,
                    detail={"error": error} if error else {},
                )
            )

    def record_cache_hit(
        self,
        *,
        client_id: str | None = None,
        style: str | None = None,
    ) -> None:
        with self._lock:
            self._audit.append(
                AuditEvent(kind="cache_hit", client_id=client_id, style=style)
            )

    def audit_log(self) -> list[dict[str, Any]]:
        with self._lock:
            return [e.to_dict() for e in self._audit]

    def reset_dev_quota(
        self,
        *,
        client_id: str | None = None,
        reset_all: bool = False,
    ) -> dict[str, Any]:
        """Clear local quota counters. Library / creation data is untouched.

        Development helper only — callers must gate via ``dev_tools_enabled()``.
        """
        with self._lock:
            if reset_all or not client_id:
                cleared_clients = list(self._client_attempts.keys())
                self._client_attempts.clear()
                self._ip_attempts.clear()
                self._global_attempts.clear()
                self._audit.append(
                    AuditEvent(
                        kind="rate_limited",
                        detail={"dev_reset": "all", "cleared_clients": cleared_clients},
                    )
                )
                return {
                    "ok": True,
                    "scope": "all",
                    "cleared_clients": cleared_clients,
                    "remaining": self.anon_limit,
                }

            had = client_id in self._client_attempts
            self._client_attempts.pop(client_id, None)
            # Drop IP buckets that only existed for this local QA client id is unknown;
            # leave IP counters unless full reset — IP is secondary protection.
            self._audit.append(
                AuditEvent(
                    kind="rate_limited",
                    client_id=client_id,
                    detail={"dev_reset": "client", "had_usage": had},
                )
            )
            return {
                "ok": True,
                "scope": "client",
                "client_id": client_id,
                "had_usage": had,
                "remaining": self.anon_limit,
            }


class FileGenerationPolicy(InMemoryGenerationPolicy):
    """Durable shared state via JSON file — survives restart; multi-process safe via lock+atomic write.

    Suitable for single-host production-shaped deploys. Replace with Redis/DB for multi-region.
    """

    def __init__(
        self,
        path: Path | str | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        default = Path(
            os.environ.get(
                "DOOJI_POLICY_PATH",
                str(Path.home() / ".dooji" / "generation_policy.json"),
            )
        )
        self.path = Path(path) if path else default
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        with self._lock:
            self._client_attempts = {
                k: list(v) for k, v in (data.get("client_attempts") or {}).items()
            }
            self._ip_attempts = {
                k: list(v) for k, v in (data.get("ip_attempts") or {}).items()
            }
            self._global_attempts = list(data.get("global_attempts") or [])
            self._audit = [
                AuditEvent(
                    kind=e.get("kind", "provider_attempt"),
                    client_id=e.get("client_id"),
                    ip=e.get("ip"),
                    style=e.get("style"),
                    at=float(e.get("at") or time.time()),
                    detail=e.get("detail") or {},
                )
                for e in (data.get("audit") or [])[-500:]
            ]

    def _persist(self) -> None:
        payload = {
            "client_attempts": self._client_attempts,
            "ip_attempts": self._ip_attempts,
            "global_attempts": self._global_attempts,
            "audit": [e.to_dict() for e in self._audit[-500:]],
        }
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload), encoding="utf-8")
        tmp.replace(self.path)

    def record_provider_attempt(self, **kwargs: Any) -> None:  # type: ignore[override]
        super().record_provider_attempt(**kwargs)
        with self._lock:
            self._persist()

    def record_success(self, **kwargs: Any) -> None:  # type: ignore[override]
        super().record_success(**kwargs)
        with self._lock:
            self._persist()

    def record_failure(self, **kwargs: Any) -> None:  # type: ignore[override]
        super().record_failure(**kwargs)
        with self._lock:
            self._persist()

    def reset_dev_quota(self, **kwargs: Any) -> dict[str, Any]:  # type: ignore[override]
        result = super().reset_dev_quota(**kwargs)
        with self._lock:
            self._persist()
        return result


def dev_tools_enabled() -> bool:
    """True only when explicitly enabled for local QA.

    Production must leave ``DOOJI_DEV_TOOLS`` unset/false so reset endpoints 404.
    """
    raw = (os.environ.get("DOOJI_DEV_TOOLS") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


_policy_singleton: GenerationPolicy | None = None
_policy_lock = threading.Lock()


def get_generation_policy() -> GenerationPolicy:
    """Factory — DOOJI_POLICY=memory|file (default file for durable local)."""
    global _policy_singleton
    with _policy_lock:
        if _policy_singleton is not None:
            return _policy_singleton
        mode = (os.environ.get("DOOJI_POLICY") or "file").lower().strip()
        if mode == "memory":
            _policy_singleton = InMemoryGenerationPolicy()
        else:
            _policy_singleton = FileGenerationPolicy()
        return _policy_singleton


def reset_generation_policy_for_tests(policy: GenerationPolicy | None = None) -> None:
    """Test helper — inject or clear singleton."""
    global _policy_singleton
    with _policy_lock:
        _policy_singleton = policy


def reset_dev_quota(
    *,
    client_id: str | None = None,
    reset_all: bool = False,
    policy: GenerationPolicy | None = None,
) -> dict[str, Any]:
    """Reset local/dev GenerationPolicy counters (not Library data)."""
    pol = policy if policy is not None else get_generation_policy()
    reset = getattr(pol, "reset_dev_quota", None)
    if not callable(reset):
        raise RuntimeError("active GenerationPolicy does not support reset_dev_quota")
    return reset(client_id=client_id, reset_all=reset_all)
