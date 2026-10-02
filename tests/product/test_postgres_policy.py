"""Postgres generation-policy + production deployment wiring tests.

Live Postgres integration runs only when DOOJI_TEST_DATABASE_URL (or DATABASE_URL)
is set. Otherwise semantic tests use a shared in-process table store that mirrors
the Postgres reserve algorithm (rolling window, atomic lock, persistence).
"""
from __future__ import annotations

import base64
import os
import struct
import sys
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.api.app import handle_transform
from product.api.health import build_health_payload
from product.policy.exceptions import PolicyStoreUnavailable, QuotaExceeded
from product.policy.generation_policy import (
    InMemoryGenerationPolicy,
    get_generation_policy,
    reset_generation_policy_for_tests,
)
from product.policy.postgres_policy import (
    PostgresGenerationPolicy,
    normalize_database_url,
)
from product.providers import get_provider


def _tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    raw = bytes([0, 255, 0, 0, 255])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def _payload(**extra: Any) -> dict[str, Any]:
    body = {
        "style": "gummy",
        "doodle_base64": base64.b64encode(_tiny_png()).decode("ascii"),
        "anonymous_client_id": "anon-pg-test",
    }
    body.update(extra)
    return body


def _clear_env(*keys: str) -> dict[str, str | None]:
    prev = {k: os.environ.get(k) for k in keys}
    for k in keys:
        os.environ.pop(k, None)
    return prev


def _restore_env(prev: dict[str, str | None]) -> None:
    for k, v in prev.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


# ---------------------------------------------------------------------------
# In-process table store mirroring PostgresGenerationPolicy semantics
# ---------------------------------------------------------------------------


class _TableStore:
    """Shared durable rows for tests (process-local stand-in for Postgres tables)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.attempts: list[dict[str, Any]] = []
        self.audit: list[dict[str, Any]] = []


class TableBackedGenerationPolicy:
    """Mirrors Postgres reserve/check semantics for offline tests."""

    def __init__(
        self,
        store: _TableStore,
        *,
        anon_limit: int = 6,
        global_daily: int = 1000,
        window_seconds: float = 24 * 60 * 60,
        ip_burst_limit: int = 30,
    ) -> None:
        self.store = store
        self.anon_limit = anon_limit
        self.global_daily = global_daily
        self.window = window_seconds
        self.ip_burst_limit = ip_burst_limit

    def _prune(self, now: float) -> list[dict[str, Any]]:
        cutoff = now - self.window
        return [r for r in self.store.attempts if r["at"] > cutoff]

    def _decision(self, client_id: str, ip: str | None, now: float):
        from product.policy.generation_policy import PolicyDecision

        rows = self._prune(now)
        client_rows = [r for r in rows if r["client_id"] == client_id]
        ip_rows = [r for r in rows if ip and r.get("ip") == ip]
        if len(rows) >= self.global_daily:
            oldest = min((r["at"] for r in rows), default=now)
            return PolicyDecision(
                allowed=False,
                reason="global_budget_blocked",
                remaining=0,
                reset_at=oldest + self.window,
                message="You've reached your generation limit for now. Try again later.",
            )
        if ip and len(ip_rows) >= self.ip_burst_limit:
            oldest = min(r["at"] for r in ip_rows)
            return PolicyDecision(
                allowed=False,
                reason="rate_limited",
                remaining=0,
                reset_at=oldest + self.window,
                message="You've reached your generation limit for now. Try again later.",
            )
        used = len(client_rows)
        if used >= self.anon_limit:
            oldest = min((r["at"] for r in client_rows), default=now)
            return PolicyDecision(
                allowed=False,
                reason="rate_limited",
                remaining=0,
                reset_at=oldest + self.window,
                message="You've reached your generation limit for now. Try again later.",
            )
        oldest = min((r["at"] for r in client_rows), default=now)
        return PolicyDecision(
            allowed=True,
            reason="ok",
            remaining=max(0, self.anon_limit - used),
            reset_at=oldest + self.window,
        )

    def check(self, *, client_id: str, ip: str | None = None):
        with self.store.lock:
            return self._decision(client_id, ip, time.time())

    def record_provider_attempt(
        self, *, client_id: str, ip: str | None = None, style: str | None = None
    ) -> None:
        with self.store.lock:
            now = time.time()
            decision = self._decision(client_id, ip, now)
            if not decision.allowed:
                raise QuotaExceeded(decision)
            self.store.attempts.append(
                {"client_id": client_id, "ip": ip, "style": style, "at": now}
            )
            self.store.audit.append(
                {"kind": "provider_attempt", "client_id": client_id, "style": style}
            )

    def record_success(self, **kwargs: Any) -> None:
        with self.store.lock:
            self.store.audit.append({"kind": "successful_generation", **kwargs})

    def record_failure(self, **kwargs: Any) -> None:
        with self.store.lock:
            self.store.audit.append({"kind": "provider_failure", **kwargs})

    def record_cache_hit(self, **kwargs: Any) -> None:
        with self.store.lock:
            self.store.audit.append({"kind": "cache_hit", **kwargs})

    def audit_log(self) -> list[dict[str, Any]]:
        with self.store.lock:
            return list(self.store.audit)

    def ping(self) -> None:
        return None


# ---------------------------------------------------------------------------
# Config / fail-closed
# ---------------------------------------------------------------------------


def test_normalize_database_url_postgres_scheme() -> None:
    assert normalize_database_url("postgres://u:p@h/db").startswith("postgresql://")
    assert normalize_database_url("postgresql://u:p@h/db").startswith("postgresql://")


def test_production_requires_postgres_policy_not_memory() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_POLICY", "DATABASE_URL", "DOOJI_DATABASE_URL")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["DOOJI_POLICY"] = "memory"
    reset_generation_policy_for_tests(None)
    try:
        try:
            get_generation_policy()
            assert False, "expected RuntimeError"
        except RuntimeError as exc:
            assert "postgres" in str(exc).lower()
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_production_requires_postgres_policy_not_file() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_POLICY", "DATABASE_URL")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["DOOJI_POLICY"] = "file"
    reset_generation_policy_for_tests(None)
    try:
        try:
            get_generation_policy()
            assert False, "expected RuntimeError"
        except RuntimeError as exc:
            assert "postgres" in str(exc).lower()
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_production_postgres_requires_database_url() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_POLICY", "DATABASE_URL", "DOOJI_DATABASE_URL")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["DOOJI_POLICY"] = "postgres"
    reset_generation_policy_for_tests(None)
    try:
        try:
            get_generation_policy()
            assert False, "expected PolicyStoreUnavailable or RuntimeError"
        except (PolicyStoreUnavailable, RuntimeError) as exc:
            assert "DATABASE_URL" in str(exc) or "database" in str(exc).lower()
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_production_provider_still_requires_xai() -> None:
    prev = _clear_env("DOOJI_ENV", "IMAGE_PROVIDER", "XAI_API_KEY")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["IMAGE_PROVIDER"] = "xai"
    try:
        try:
            get_provider()
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "XAI_API_KEY" in str(exc)
    finally:
        _restore_env(prev)


def test_dev_tools_disabled_by_default() -> None:
    prev = _clear_env("DOOJI_DEV_TOOLS", "DOOJI_ENV")
    os.environ["DOOJI_ENV"] = "production"
    try:
        from product.policy.generation_policy import dev_tools_enabled

        assert not dev_tools_enabled()
    finally:
        _restore_env(prev)


# ---------------------------------------------------------------------------
# Durable / postgres-equivalent semantics (table store)
# ---------------------------------------------------------------------------


def test_table_six_allowed_seventh_blocked() -> None:
    store = _TableStore()
    pol = TableBackedGenerationPolicy(store, anon_limit=6, global_daily=1000)
    client = "c-six"
    for i in range(6):
        assert pol.check(client_id=client).allowed, i
        pol.record_provider_attempt(client_id=client, style="gummy")
    blocked = pol.check(client_id=client)
    assert not blocked.allowed
    assert blocked.reason == "rate_limited"


def test_table_rolling_window() -> None:
    store = _TableStore()
    pol = TableBackedGenerationPolicy(
        store, anon_limit=2, global_daily=1000, window_seconds=0.15
    )
    pol.record_provider_attempt(client_id="w")
    pol.record_provider_attempt(client_id="w")
    assert not pol.check(client_id="w").allowed
    time.sleep(0.2)
    assert pol.check(client_id="w").allowed


def test_table_cache_and_rejected_do_not_consume() -> None:
    store = _TableStore()
    pol = TableBackedGenerationPolicy(store, anon_limit=1, global_daily=1000)
    pol.record_cache_hit(client_id="c", style="gummy")
    assert pol.check(client_id="c").allowed
    assert len(store.attempts) == 0
    # rejected-before-provider: check only
    assert handle_transform(
        _payload(anonymous_client_id="c"),
        provider_name="mock",
        policy=TableBackedGenerationPolicy(store, anon_limit=0, global_daily=1000),
    )["status"] == "rate_limited"
    assert len(store.attempts) == 0


def test_table_persistence_across_policy_recreation() -> None:
    store = _TableStore()
    a = TableBackedGenerationPolicy(store, anon_limit=6, global_daily=1000)
    for _ in range(3):
        a.record_provider_attempt(client_id="persist", style="clay")
    b = TableBackedGenerationPolicy(store, anon_limit=6, global_daily=1000)
    d = b.check(client_id="persist")
    assert d.allowed
    assert d.remaining == 3


def test_table_concurrent_cannot_overspend() -> None:
    store = _TableStore()
    pol = TableBackedGenerationPolicy(store, anon_limit=1, global_daily=1000)

    def once() -> str:
        try:
            if not pol.check(client_id="race").allowed:
                return "blocked"
            pol.record_provider_attempt(client_id="race", style="gummy")
            return "ok"
        except QuotaExceeded:
            return "race_blocked"

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [f.result() for f in as_completed([pool.submit(once) for _ in range(8)])]
    assert results.count("ok") == 1
    assert len(store.attempts) == 1


def test_memory_concurrent_cannot_overspend() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=1, global_daily=1000)

    def once() -> str:
        try:
            if not pol.check(client_id="race-m").allowed:
                return "blocked"
            pol.record_provider_attempt(client_id="race-m", style="gummy")
            return "ok"
        except QuotaExceeded:
            return "race_blocked"

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [f.result() for f in as_completed([pool.submit(once) for _ in range(8)])]
    assert results.count("ok") == 1


def test_handle_transform_policy_unavailable_no_provider() -> None:
    class DeadPolicy:
        def check(self, **kwargs):  # noqa: ANN003
            raise PolicyStoreUnavailable("down")

        def record_provider_attempt(self, **kwargs):  # noqa: ANN003
            raise AssertionError("must not reserve when check failed")

    body = handle_transform(
        _payload(),
        provider_name="mock",
        policy=DeadPolicy(),
    )
    assert body["status"] == "error"
    assert body["error"] == "policy_store_unavailable"


def test_handle_transform_reserve_unavailable_no_provider_charge_path() -> None:
    class CheckOkReserveDead:
        def check(self, **kwargs):  # noqa: ANN003
            from product.policy.generation_policy import PolicyDecision

            return PolicyDecision(allowed=True, reason="ok", remaining=1)

        def record_provider_attempt(self, **kwargs):  # noqa: ANN003
            raise PolicyStoreUnavailable("down at reserve")

    body = handle_transform(
        _payload(),
        provider_name="mock",
        policy=CheckOkReserveDead(),
    )
    assert body["error"] == "policy_store_unavailable"


def test_postgres_connect_failure_raises_unavailable() -> None:
    with patch(
        "product.policy.postgres_policy._import_psycopg",
        side_effect=PolicyStoreUnavailable("psycopg missing"),
    ):
        try:
            PostgresGenerationPolicy(
                dsn="postgresql://invalid:invalid@127.0.0.1:1/none",
                autocommit_schema=False,
            )
            # Constructor may not connect until ensure_schema
        except PolicyStoreUnavailable:
            pass
    pol = PostgresGenerationPolicy(
        dsn="postgresql://invalid:invalid@127.0.0.1:1/none",
        autocommit_schema=False,
    )
    with patch.object(pol, "_connect", side_effect=PolicyStoreUnavailable("down")):
        try:
            pol.ping()
            assert False, "expected PolicyStoreUnavailable"
        except PolicyStoreUnavailable:
            pass


def test_health_ok_without_db_in_dev() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_POLICY")
    reset_generation_policy_for_tests(InMemoryGenerationPolicy())
    try:
        code, body = build_health_payload(policy=InMemoryGenerationPolicy())
        assert code == 200
        assert body["status"] == "ok"
        assert body["service"] == "dooji-transform"
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_health_unhealthy_when_postgres_ping_fails() -> None:
    class BrokenPg:
        def ping(self) -> None:
            raise PolicyStoreUnavailable("db down")

    prev = _clear_env("DOOJI_ENV")
    os.environ["DOOJI_ENV"] = "production"
    try:
        code, body = build_health_payload(policy=BrokenPg())
        assert code == 503
        assert body["status"] == "unhealthy"
        assert body["database"] == "unavailable"
    finally:
        _restore_env(prev)


def test_normal_generation_still_works_with_table_policy() -> None:
    prev = _clear_env("DOOJI_GENERATIONS_DISABLED", "DOOJI_ENV", "IMAGE_PROVIDER")
    os.environ["IMAGE_PROVIDER"] = "mock"
    store = _TableStore()
    pol = TableBackedGenerationPolicy(store, anon_limit=6, global_daily=1000)
    body = handle_transform(_payload(), provider_name="mock", policy=pol)
    assert body["status"] == "ok"
    assert len(store.attempts) == 1
    _restore_env(prev)


def test_live_postgres_if_configured() -> None:
    """Optional integration — set DOOJI_TEST_DATABASE_URL to exercise real SQL."""
    url = (
        os.environ.get("DOOJI_TEST_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or ""
    ).strip()
    if not url:
        print("skip live postgres (set DOOJI_TEST_DATABASE_URL)")
        return
    # Isolate from production env flags during the test.
    prev = _clear_env("DOOJI_ENV")
    try:
        pol = PostgresGenerationPolicy(
            dsn=url,
            anon_limit=6,
            global_daily=10_000,
            window_seconds=60,
        )
        client = f"live-{int(time.time())}"
        assert pol.check(client_id=client).allowed
        pol.record_provider_attempt(client_id=client, style="gummy")
        pol2 = PostgresGenerationPolicy(
            dsn=url,
            anon_limit=6,
            global_daily=10_000,
            window_seconds=60,
            autocommit_schema=False,
        )
        d = pol2.check(client_id=client)
        assert d.allowed
        assert d.remaining == 5
        code, health = build_health_payload(policy=pol2)
        assert code == 200
        assert health.get("database") == "ok"
    finally:
        _restore_env(prev)


if __name__ == "__main__":
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"ok {fn.__name__}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"FAIL {fn.__name__}: {type(exc).__name__}: {exc}")
    print(f"passed {len(tests) - failed}/{len(tests)}")
    raise SystemExit(1 if failed else 0)
