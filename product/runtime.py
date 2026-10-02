"""Runtime environment helpers for production-safe defaults.

Development stays convenient (mock / LAN).
Production (DOOJI_ENV=production) fails closed.
"""
from __future__ import annotations

import os


def env_flag(name: str) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def is_production() -> bool:
    """True when the process is explicitly marked production."""
    raw = (os.environ.get("DOOJI_ENV") or "").strip().lower()
    return raw in ("production", "prod")


def generations_disabled() -> bool:
    """Emergency kill switch — reject new provider generations without charging quota."""
    return env_flag("DOOJI_GENERATIONS_DISABLED")


def resolve_bind_port(default: int = 8080) -> int:
    """Prefer DOOJI_PORT, then platform PORT, then local default."""
    for key in ("DOOJI_PORT", "PORT"):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            return int(raw)
    return default


def resolve_bind_host(default: str = "0.0.0.0") -> str:
    return (os.environ.get("DOOJI_HOST") or default).strip() or default


def max_body_bytes() -> int:
    # ~8 MiB JSON envelope (base64 doodle + strokes).
    return int(os.environ.get("DOOJI_MAX_BODY_BYTES") or 8_000_000)


def max_image_bytes() -> int:
    # Decoded PNG budget before provider work.
    return int(os.environ.get("DOOJI_MAX_IMAGE_BYTES") or 5_000_000)


def max_stroke_count() -> int:
    return int(os.environ.get("DOOJI_MAX_STROKES") or 2_000)


def provider_timeout_seconds() -> float:
    """Overall wall-clock budget for a single provider generation."""
    return float(os.environ.get("DOOJI_PROVIDER_TIMEOUT_S") or 90)


def provider_http_timeout_seconds() -> float:
    return float(os.environ.get("DOOJI_PROVIDER_HTTP_TIMEOUT_S") or 60)


def provider_download_timeout_seconds() -> float:
    return float(os.environ.get("DOOJI_PROVIDER_DOWNLOAD_TIMEOUT_S") or 45)


def allow_doodle_path() -> bool:
    """Filesystem doodle_path is local/dev only."""
    if is_production():
        return False
    return env_flag("DOOJI_DEV_TOOLS") or env_flag("DOOJI_ALLOW_DOODLE_PATH")


def allow_dry_run() -> bool:
    """dry_run (mock + skip quota) is local/dev only."""
    if is_production():
        return False
    return True
