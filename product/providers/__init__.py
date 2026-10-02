"""Provider registry / factory."""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

from product.providers.mock import MockImageProvider
from product.providers.xai import XAIImageProvider
from product.runtime import is_production

if TYPE_CHECKING:
    from product.providers.base import ImageProvider

# IMAGE_PROVIDER=xai|mock  (dev default: mock when no key, else xai)
DEFAULT_PROVIDER = "xai"


def get_provider(name: str | None = None) -> ImageProvider:
    chosen = (name or os.environ.get("IMAGE_PROVIDER") or "").strip().lower()
    if is_production():
        # Fail closed: production must explicitly run xAI with a key present.
        if not chosen:
            chosen = "xai"
        if chosen in ("mock", "dry", "dry_run"):
            raise ValueError(
                "IMAGE_PROVIDER=mock is not allowed when DOOJI_ENV=production"
            )
        if chosen not in ("xai", "x-ai", "grok"):
            raise ValueError(f"unknown IMAGE_PROVIDER={chosen!r}; expected xai")
        from lab.v4.generative.xai_edit import has_xai_key

        if not has_xai_key():
            raise ValueError("XAI_API_KEY is required when DOOJI_ENV=production")
        return XAIImageProvider()

    if not chosen:
        from lab.v4.generative.xai_edit import has_xai_key

        chosen = "xai" if has_xai_key() else "mock"
    if chosen in ("mock", "dry", "dry_run"):
        return MockImageProvider()
    if chosen in ("xai", "x-ai", "grok"):
        return XAIImageProvider()
    raise ValueError(f"unknown IMAGE_PROVIDER={chosen!r}; expected xai|mock")


__all__ = [
    "MockImageProvider",
    "XAIImageProvider",
    "get_provider",
]
