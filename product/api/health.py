"""Health / readiness helpers for the transform HTTP surface."""
from __future__ import annotations

from typing import Any

from product.policy.exceptions import PolicyStoreUnavailable
from product.policy.generation_policy import get_generation_policy, policy_backend_name
from product.runtime import is_production


def _requires_database(*, policy: Any = None, backend: str) -> bool:
    if is_production():
        return True
    if backend == "postgres":
        return True
    if policy is not None and type(policy).__name__ == "PostgresGenerationPolicy":
        return True
    return False


def build_health_payload(*, policy=None) -> tuple[int, dict[str, Any]]:
    """Return (http_status, json_body) for GET /health and /v1/health.

    Development (memory/file): liveness only.
    Production / postgres: readiness includes a DB ping.
    Never calls xAI. Never includes secrets or connection strings.
    """
    backend = policy_backend_name(policy)
    body: dict[str, Any] = {
        "status": "ok",
        "service": "dooji-transform",
        "env": "production" if is_production() else "development",
        "policy": backend,
    }

    if not _requires_database(policy=policy, backend=backend):
        return 200, body

    try:
        pol = policy if policy is not None else get_generation_policy()
        ping = getattr(pol, "ping", None)
        if callable(ping):
            ping()
        body["database"] = "ok"
        return 200, body
    except PolicyStoreUnavailable:
        return 503, {
            "status": "unhealthy",
            "service": "dooji-transform",
            "env": "production" if is_production() else "development",
            "policy": backend,
            "database": "unavailable",
            "error": "policy_store_unavailable",
        }
    except Exception:  # noqa: BLE001
        return 503, {
            "status": "unhealthy",
            "service": "dooji-transform",
            "env": "production" if is_production() else "development",
            "policy": backend,
            "database": "unavailable",
            "error": "policy_store_unavailable",
        }
