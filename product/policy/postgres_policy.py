"""Postgres-backed GenerationPolicy for durable shared quota state.

Schema (auto-created on ensure_schema / startup):
  generation_attempts  — rows that consume quota (provider attempts)
  generation_audit     — audit trail (success/failure/cache/blocks)

Timestamps are TIMESTAMPTZ (UTC). No images, prompts, or secrets are stored.

Concurrency: pg_advisory_xact_lock on reserve so two requests cannot both
consume the final available slot.
"""
from __future__ import annotations

import json
import os
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator
from urllib.parse import urlparse

from product.policy.exceptions import PolicyStoreUnavailable, QuotaExceeded
from product.policy.generation_policy import (
    DEFAULT_ANON_LIMIT,
    DEFAULT_GLOBAL_DAILY,
    WINDOW_SECONDS,
    AuditEvent,
    PolicyDecision,
    _env_int,
)

SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS generation_attempts (
        id BIGSERIAL PRIMARY KEY,
        client_id TEXT NOT NULL,
        ip TEXT,
        style TEXT,
        attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_generation_attempts_client_time
        ON generation_attempts (client_id, attempted_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_generation_attempts_ip_time
        ON generation_attempts (ip, attempted_at DESC)
        WHERE ip IS NOT NULL
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_generation_attempts_time
        ON generation_attempts (attempted_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS generation_audit (
        id BIGSERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        client_id TEXT,
        ip TEXT,
        style TEXT,
        detail JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_generation_audit_created
        ON generation_audit (created_at DESC)
    """,
)

# Fixed advisory-lock namespace for global budget serialization.
_GLOBAL_LOCK_KEY = 0xD001_0001


def normalize_database_url(url: str) -> str:
    """Render often provides postgres:// — psycopg expects postgresql://."""
    raw = (url or "").strip()
    if raw.startswith("postgres://"):
        return "postgresql://" + raw[len("postgres://") :]
    return raw


def resolve_database_url() -> str:
    return normalize_database_url(
        (os.environ.get("DATABASE_URL") or os.environ.get("DOOJI_DATABASE_URL") or "").strip()
    )


def _ts_to_epoch(value: Any) -> float:
    if value is None:
        return time.time()
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.timestamp()
    return time.time()


def _import_psycopg():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:  # pragma: no cover
        raise PolicyStoreUnavailable(
            "psycopg is required for DOOJI_POLICY=postgres "
            "(pip install 'psycopg[binary]')"
        ) from exc
    return psycopg, dict_row


class PostgresGenerationPolicy:
    """Production GenerationPolicy — shared durable quota via Postgres."""

    def __init__(
        self,
        *,
        dsn: str | None = None,
        anon_limit: int | None = None,
        global_daily: int | None = None,
        window_seconds: float = WINDOW_SECONDS,
        ip_burst_limit: int = 30,
        autocommit_schema: bool = True,
    ) -> None:
        self.dsn = normalize_database_url(dsn or resolve_database_url())
        if not self.dsn:
            raise PolicyStoreUnavailable(
                "DATABASE_URL is required when DOOJI_POLICY=postgres"
            )
        # Never log DSN — keep only a safe host label for diagnostics.
        self._dsn_host = _safe_dsn_host(self.dsn)
        self.anon_limit = anon_limit if anon_limit is not None else _env_int(
            "DOOJI_ANON_GENERATION_LIMIT", DEFAULT_ANON_LIMIT
        )
        self.global_daily = global_daily if global_daily is not None else _env_int(
            "DOOJI_GLOBAL_DAILY_BUDGET", DEFAULT_GLOBAL_DAILY
        )
        self.window = float(window_seconds)
        self.ip_burst_limit = ip_burst_limit
        self._schema_ready = False
        self._init_lock = threading.Lock()
        if autocommit_schema:
            self.ensure_schema()

    def ping(self) -> None:
        """Connectivity probe for health/readiness. Raises PolicyStoreUnavailable."""
        try:
            with self._connect() as conn:
                conn.execute("SELECT 1")
        except PolicyStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable(
                f"postgres ping failed (host={self._dsn_host})"
            ) from exc

    def ensure_schema(self) -> None:
        with self._init_lock:
            if self._schema_ready:
                return
            try:
                with self._connect() as conn:
                    for statement in SCHEMA_STATEMENTS:
                        conn.execute(statement)
                    conn.commit()
                self._schema_ready = True
            except PolicyStoreUnavailable:
                raise
            except Exception as exc:  # noqa: BLE001
                raise PolicyStoreUnavailable(
                    f"postgres schema init failed (host={self._dsn_host})"
                ) from exc

    def ensure_ready(self) -> None:
        self.ensure_schema()
        self.ping()

    @contextmanager
    def _connect(self) -> Iterator[Any]:
        psycopg, dict_row = _import_psycopg()
        try:
            conn = psycopg.connect(self.dsn, row_factory=dict_row)
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable(
                f"postgres connection failed (host={self._dsn_host})"
            ) from exc
        try:
            yield conn
        finally:
            conn.close()

    def _cutoff_expr(self) -> tuple[str, tuple[Any, ...]]:
        # Interval from window_seconds so tests can use short windows.
        return ("NOW() - (%s * INTERVAL '1 second')", (self.window,))

    def _count_attempts(
        self,
        conn: Any,
        *,
        client_id: str | None = None,
        ip: str | None = None,
    ) -> int:
        cutoff_sql, cutoff_params = self._cutoff_expr()
        if client_id is not None:
            row = conn.execute(
                f"""
                SELECT COUNT(*)::int AS n
                FROM generation_attempts
                WHERE client_id = %s AND attempted_at > {cutoff_sql}
                """,
                (client_id, *cutoff_params),
            ).fetchone()
        elif ip is not None:
            row = conn.execute(
                f"""
                SELECT COUNT(*)::int AS n
                FROM generation_attempts
                WHERE ip = %s AND attempted_at > {cutoff_sql}
                """,
                (ip, *cutoff_params),
            ).fetchone()
        else:
            row = conn.execute(
                f"""
                SELECT COUNT(*)::int AS n
                FROM generation_attempts
                WHERE attempted_at > {cutoff_sql}
                """,
                cutoff_params,
            ).fetchone()
        return int((row or {}).get("n") or 0)

    def _oldest_attempt(
        self,
        conn: Any,
        *,
        client_id: str | None = None,
        ip: str | None = None,
        global_scope: bool = False,
    ) -> float | None:
        cutoff_sql, cutoff_params = self._cutoff_expr()
        if global_scope:
            row = conn.execute(
                f"""
                SELECT MIN(attempted_at) AS oldest
                FROM generation_attempts
                WHERE attempted_at > {cutoff_sql}
                """,
                cutoff_params,
            ).fetchone()
        elif ip is not None:
            row = conn.execute(
                f"""
                SELECT MIN(attempted_at) AS oldest
                FROM generation_attempts
                WHERE ip = %s AND attempted_at > {cutoff_sql}
                """,
                (ip, *cutoff_params),
            ).fetchone()
        else:
            row = conn.execute(
                f"""
                SELECT MIN(attempted_at) AS oldest
                FROM generation_attempts
                WHERE client_id = %s AND attempted_at > {cutoff_sql}
                """,
                (client_id, *cutoff_params),
            ).fetchone()
        oldest = (row or {}).get("oldest")
        return _ts_to_epoch(oldest) if oldest is not None else None

    def _decision_from_counts(
        self,
        *,
        client_id: str,
        ip: str | None,
        client_n: int,
        global_n: int,
        ip_n: int,
        now: float,
        oldest_client: float | None,
        oldest_global: float | None,
        oldest_ip: float | None,
    ) -> PolicyDecision:
        if global_n >= self.global_daily:
            reset_at = (oldest_global or now) + self.window
            return PolicyDecision(
                allowed=False,
                reason="global_budget_blocked",
                remaining=0,
                reset_at=reset_at,
                message="You've reached your generation limit for now. Try again later.",
            )
        if ip and ip_n >= self.ip_burst_limit:
            reset_at = (oldest_ip or now) + self.window
            return PolicyDecision(
                allowed=False,
                reason="rate_limited",
                remaining=0,
                reset_at=reset_at,
                message="You've reached your generation limit for now. Try again later.",
            )
        remaining = max(0, self.anon_limit - client_n)
        if client_n >= self.anon_limit:
            reset_at = (oldest_client or now) + self.window
            return PolicyDecision(
                allowed=False,
                reason="rate_limited",
                remaining=0,
                reset_at=reset_at,
                message="You've reached your generation limit for now. Try again later.",
            )
        reset_at = (oldest_client or now) + self.window
        return PolicyDecision(
            allowed=True,
            reason="ok",
            remaining=remaining,
            reset_at=reset_at,
        )

    def _insert_audit(
        self,
        conn: Any,
        *,
        kind: str,
        client_id: str | None = None,
        ip: str | None = None,
        style: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        conn.execute(
            """
            INSERT INTO generation_audit (kind, client_id, ip, style, detail)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            """,
            (
                kind,
                client_id,
                ip,
                style,
                json.dumps(detail or {}),
            ),
        )

    def check(self, *, client_id: str, ip: str | None = None) -> PolicyDecision:
        now = time.time()
        try:
            with self._connect() as conn:
                client_n = self._count_attempts(conn, client_id=client_id)
                global_n = self._count_attempts(conn)
                ip_n = self._count_attempts(conn, ip=ip) if ip else 0
                oldest_client = self._oldest_attempt(conn, client_id=client_id)
                oldest_global = self._oldest_attempt(conn, global_scope=True)
                oldest_ip = self._oldest_attempt(conn, ip=ip) if ip else None
                decision = self._decision_from_counts(
                    client_id=client_id,
                    ip=ip,
                    client_n=client_n,
                    global_n=global_n,
                    ip_n=ip_n,
                    now=now,
                    oldest_client=oldest_client,
                    oldest_global=oldest_global,
                    oldest_ip=oldest_ip,
                )
                if not decision.allowed:
                    kind = (
                        "global_budget_blocked"
                        if decision.reason == "global_budget_blocked"
                        else "rate_limited"
                    )
                    detail = {"scope": "ip"} if ip and decision.reason == "rate_limited" and ip_n >= self.ip_burst_limit else {}
                    self._insert_audit(
                        conn,
                        kind=kind,
                        client_id=client_id,
                        ip=ip,
                        detail=detail,
                    )
                    conn.commit()
                return decision
        except PolicyStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable("postgres check failed") from exc

    def record_provider_attempt(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None:
        """Atomically re-check limits and insert a quota-consuming attempt."""
        now = time.time()
        try:
            with self._connect() as conn:
                # Serialize reserves for this client + global budget.
                conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (client_id,))
                conn.execute("SELECT pg_advisory_xact_lock(%s)", (_GLOBAL_LOCK_KEY,))

                client_n = self._count_attempts(conn, client_id=client_id)
                global_n = self._count_attempts(conn)
                ip_n = self._count_attempts(conn, ip=ip) if ip else 0
                oldest_client = self._oldest_attempt(conn, client_id=client_id)
                oldest_global = self._oldest_attempt(conn, global_scope=True)
                oldest_ip = self._oldest_attempt(conn, ip=ip) if ip else None
                decision = self._decision_from_counts(
                    client_id=client_id,
                    ip=ip,
                    client_n=client_n,
                    global_n=global_n,
                    ip_n=ip_n,
                    now=now,
                    oldest_client=oldest_client,
                    oldest_global=oldest_global,
                    oldest_ip=oldest_ip,
                )
                if not decision.allowed:
                    kind = (
                        "global_budget_blocked"
                        if decision.reason == "global_budget_blocked"
                        else "rate_limited"
                    )
                    self._insert_audit(
                        conn,
                        kind=kind,
                        client_id=client_id,
                        ip=ip,
                        style=style,
                        detail={"race": True},
                    )
                    conn.commit()
                    raise QuotaExceeded(decision)

                conn.execute(
                    """
                    INSERT INTO generation_attempts (client_id, ip, style)
                    VALUES (%s, %s, %s)
                    """,
                    (client_id, ip, style),
                )
                self._insert_audit(
                    conn,
                    kind="provider_attempt",
                    client_id=client_id,
                    ip=ip,
                    style=style,
                )
                conn.commit()
        except (PolicyStoreUnavailable, QuotaExceeded):
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable("postgres reserve failed") from exc

    def record_success(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
    ) -> None:
        self._audit_only(
            kind="successful_generation",
            client_id=client_id,
            ip=ip,
            style=style,
        )

    def record_failure(
        self,
        *,
        client_id: str,
        ip: str | None = None,
        style: str | None = None,
        error: str | None = None,
    ) -> None:
        self._audit_only(
            kind="provider_failure",
            client_id=client_id,
            ip=ip,
            style=style,
            detail={"error": error} if error else {},
        )

    def record_cache_hit(
        self,
        *,
        client_id: str | None = None,
        style: str | None = None,
    ) -> None:
        self._audit_only(kind="cache_hit", client_id=client_id, style=style)

    def _audit_only(
        self,
        *,
        kind: str,
        client_id: str | None = None,
        ip: str | None = None,
        style: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        try:
            with self._connect() as conn:
                self._insert_audit(
                    conn,
                    kind=kind,
                    client_id=client_id,
                    ip=ip,
                    style=style,
                    detail=detail,
                )
                conn.commit()
        except PolicyStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable("postgres audit write failed") from exc

    def audit_log(self) -> list[dict[str, Any]]:
        try:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT kind, client_id, ip, style, detail, created_at
                    FROM generation_audit
                    ORDER BY id DESC
                    LIMIT 500
                    """
                ).fetchall()
            out: list[dict[str, Any]] = []
            for row in reversed(rows or []):
                detail = row.get("detail") or {}
                if isinstance(detail, str):
                    try:
                        detail = json.loads(detail)
                    except json.JSONDecodeError:
                        detail = {}
                out.append(
                    AuditEvent(
                        kind=row.get("kind") or "provider_attempt",
                        client_id=row.get("client_id"),
                        ip=row.get("ip"),
                        style=row.get("style"),
                        at=_ts_to_epoch(row.get("created_at")),
                        detail=detail if isinstance(detail, dict) else {},
                    ).to_dict()
                )
            return out
        except PolicyStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable("postgres audit read failed") from exc

    def reset_dev_quota(
        self,
        *,
        client_id: str | None = None,
        reset_all: bool = False,
    ) -> dict[str, Any]:
        """Dev helper — clear attempt rows. Never enable in production."""
        try:
            with self._connect() as conn:
                if reset_all or not client_id:
                    rows = conn.execute(
                        "SELECT DISTINCT client_id FROM generation_attempts"
                    ).fetchall()
                    cleared = [r["client_id"] for r in (rows or [])]
                    conn.execute("DELETE FROM generation_attempts")
                    self._insert_audit(
                        conn,
                        kind="rate_limited",
                        detail={"dev_reset": "all", "cleared_clients": cleared},
                    )
                    conn.commit()
                    return {
                        "ok": True,
                        "scope": "all",
                        "cleared_clients": cleared,
                        "remaining": self.anon_limit,
                    }
                had = conn.execute(
                    "SELECT 1 FROM generation_attempts WHERE client_id = %s LIMIT 1",
                    (client_id,),
                ).fetchone()
                conn.execute(
                    "DELETE FROM generation_attempts WHERE client_id = %s",
                    (client_id,),
                )
                self._insert_audit(
                    conn,
                    kind="rate_limited",
                    client_id=client_id,
                    detail={"dev_reset": "client", "had_usage": bool(had)},
                )
                conn.commit()
                return {
                    "ok": True,
                    "scope": "client",
                    "client_id": client_id,
                    "had_usage": bool(had),
                    "remaining": self.anon_limit,
                }
        except PolicyStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PolicyStoreUnavailable("postgres reset failed") from exc


def _safe_dsn_host(dsn: str) -> str:
    try:
        parsed = urlparse(dsn)
        return parsed.hostname or "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"
