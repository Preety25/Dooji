"""Generation-policy error types (structured; safe for client mapping)."""
from __future__ import annotations

from typing import Any


class PolicyStoreUnavailable(RuntimeError):
    """Quota state cannot be trusted (e.g. Postgres down). Fail closed."""

    def __init__(self, message: str = "generation policy store unavailable") -> None:
        super().__init__(message)


class QuotaExceeded(RuntimeError):
    """Atomic reserve lost a race — map to the existing rate-limited response."""

    def __init__(self, decision: Any) -> None:
        self.decision = decision
        reason = getattr(decision, "reason", None) or "rate_limited"
        super().__init__(reason)
