"""XAIImageProvider — thin adapter over lab.v4.generative.xai_edit patterns.

Secrets: reads XAI_API_KEY from the environment only. Never logs or returns the key.
"""
from __future__ import annotations

import concurrent.futures
import os
import tempfile
from pathlib import Path

from lab.v4.generative import xai_edit
from product.providers.base import (
    ProviderGenerateRequest,
    ProviderGenerateResult,
)
from product.runtime import (
    provider_download_timeout_seconds,
    provider_http_timeout_seconds,
    provider_timeout_seconds,
)


class XAIImageProvider:
    """Production ImageProvider backed by xAI Imagine image edits."""

    name = "xai"
    model = xai_edit.MODEL

    def __init__(
        self,
        *,
        resolution: str = xai_edit.DEFAULT_RESOLUTION,
        quality: str = xai_edit.DEFAULT_QUALITY,
        allow_single_fallback: bool = True,
    ) -> None:
        self.resolution = resolution
        self.quality = quality
        self.allow_single_fallback = allow_single_fallback

    def generate(self, request: ProviderGenerateRequest) -> ProviderGenerateResult:
        if not xai_edit.has_xai_key():
            return ProviderGenerateResult(
                ok=False,
                provider=self.name,
                model=self.model,
                error="XAI_API_KEY unset",
                metadata={"key_present": False},
            )

        deadline = provider_timeout_seconds()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            fut = pool.submit(self._generate_bounded, request)
            try:
                return fut.result(timeout=deadline)
            except concurrent.futures.TimeoutError:
                return ProviderGenerateResult(
                    ok=False,
                    provider=self.name,
                    model=self.model,
                    error="provider_timeout",
                    metadata={"timeout_s": deadline},
                )

    def _generate_bounded(self, request: ProviderGenerateRequest) -> ProviderGenerateResult:
        work = Path(request.work_dir) if request.work_dir else None
        tmp_ctx = None
        if work is None:
            tmp_ctx = tempfile.TemporaryDirectory(prefix="dooji_xai_")
            work = Path(tmp_ctx.name)
        try:
            work.mkdir(parents=True, exist_ok=True)
            doodle_path = work / "doodle.png"
            out_png = work / "edited.png"
            doodle_path.write_bytes(request.doodle_png)

            style_paths: list[Path] = []
            for i, raw in enumerate(request.style_ref_pngs):
                sp = work / f"style_ref_{i}.png"
                sp.write_bytes(raw)
                style_paths.append(sp)

            meta = xai_edit.edit_image(
                doodle_path=doodle_path,
                prompt=request.prompt,
                out_png=out_png,
                style_ref_paths=style_paths or None,
                resolution=request.resolution or self.resolution,
                quality=request.quality or self.quality,
                n=request.n,
                prefer_multi_image=bool(style_paths),
                allow_single_fallback=self.allow_single_fallback,
                http_timeout_s=provider_http_timeout_seconds(),
                download_timeout_s=provider_download_timeout_seconds(),
            )
            # Drop prompt from provider meta before it fans out (keep length only).
            safe_meta = {
                k: v
                for k, v in meta.items()
                if k not in ("prompt",) and "key" not in k.lower()
            }
            if "prompt" in meta:
                safe_meta["prompt_len"] = meta.get("prompt_len") or len(str(meta["prompt"]))

            # Belt-and-suspenders: never echo env key material
            key = os.environ.get("XAI_API_KEY") or ""
            blob = str(safe_meta)
            if key and key in blob:
                return ProviderGenerateResult(
                    ok=False,
                    provider=self.name,
                    model=self.model,
                    error="refusing to return metadata that may contain secrets",
                )

            if not meta.get("ok"):
                return ProviderGenerateResult(
                    ok=False,
                    provider=self.name,
                    model=self.model,
                    error=str(meta.get("error") or "xai edit failed"),
                    metadata=safe_meta,
                )

            image_bytes = out_png.read_bytes() if out_png.is_file() else None
            if not image_bytes:
                return ProviderGenerateResult(
                    ok=False,
                    provider=self.name,
                    model=self.model,
                    error="xai returned ok but no image bytes",
                    metadata=safe_meta,
                )

            return ProviderGenerateResult(
                ok=True,
                image_bytes=image_bytes,
                provider=self.name,
                model=meta.get("model_returned") or self.model,
                metadata=safe_meta,
            )
        finally:
            if tmp_ctx is not None:
                tmp_ctx.cleanup()
