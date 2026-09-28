"""Transform service — production orchestration boundary."""
from __future__ import annotations

import base64
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

from product import TRANSFORM_VERSION
from product.providers.base import ProviderGenerateRequest
from product.providers import get_provider
from product.transform.contracts import TransformRequest, TransformResult
from product.transform.postprocess import postprocess_meta, run_postprocess, write_png
from product.transform.prompt_compiler import compile_prompt, default_recognition
from product.transform.styles import load_style

if TYPE_CHECKING:
    from product.providers.base import ImageProvider


class TransformService:
    """Server-side: ingest → (raster) → prompt → provider → postprocess → result."""

    def __init__(self, provider: ImageProvider | None = None, *, root: Path | None = None) -> None:
        self.provider = provider or get_provider()
        self.root = root

    def transform(self, request: TransformRequest) -> TransformResult:
        style_cfg = load_style(request.style, root=self.root)

        # 1) Resolve doodle PNG bytes (client raster preferred; strokes = fallback)
        try:
            doodle_png, doodle_source = self._resolve_doodle(request)
        except Exception as exc:
            return TransformResult(
                status="error",
                style=request.style,
                transform_version=TRANSFORM_VERSION,
                error=f"ingest failed: {type(exc).__name__}: {exc}",
            )

        recognition = (
            request.options.recognition
            if request.options.recognition is not None
            else default_recognition(client_doodle_id=request.client_doodle_id)
        )

        sheet = style_cfg.resolve_sheet(root=self.root)
        style_refs: list[bytes] = []
        if sheet is not None:
            style_refs.append(sheet.read_bytes())

        prompt = compile_prompt(
            style=style_cfg,
            recognition=recognition,
            multi_image=bool(style_refs),
            n_style_refs=len(style_refs),
        )

        # dry_run status only when the client explicitly requests it — not merely
        # because IMAGE_PROVIDER=mock (mock still returns a real image_base64).
        dry = bool(request.options.dry_run)

        with tempfile.TemporaryDirectory(prefix="dooji_transform_") as tmp:
            work = Path(tmp)
            gen = self.provider.generate(
                ProviderGenerateRequest(
                    doodle_png=doodle_png,
                    prompt=prompt,
                    style_ref_pngs=style_refs,
                    work_dir=str(work / "provider"),
                )
            )
            if not gen.ok or not gen.image_bytes:
                return TransformResult(
                    status="error",
                    style=request.style,
                    transform_version=TRANSFORM_VERSION,
                    provider=gen.provider or getattr(self.provider, "name", None),
                    model=gen.model,
                    error=gen.error or "provider failed",
                    metadata={
                        "provider": gen.metadata,
                        "style_sheet": str(sheet) if sheet else None,
                        "prompt_len": len(prompt),
                        # prompts stay server-side — length only
                    },
                )

            pp = run_postprocess(
                gen.image_bytes,
                size=int(request.options.size or 1024),
                skip=False,
            )
            out_path = work / "final.png"
            write_png(pp.image_bytes, out_path)
            # Persist beside caller only if they passed a path desire later; for now
            # return bytes + optional copy under out/product when DOOJI_OUT is set.
            persisted = self._maybe_persist(
                pp.image_bytes,
                client_id=request.client_doodle_id,
                style=request.style,
            )

            b64 = base64.b64encode(pp.image_bytes).decode("ascii")
            status = "dry_run" if dry else "ok"
            return TransformResult(
                status=status,
                style=request.style,
                transform_version=TRANSFORM_VERSION,
                provider=gen.provider or getattr(self.provider, "name", None),
                model=gen.model,
                image_path=persisted,
                image_url=None,
                image_base64=b64,
                metadata={
                    "prompt_len": len(prompt),
                    "style_id": style_cfg.id,
                    "style_version": style_cfg.version,
                    "style_sheet": str(sheet) if sheet else None,
                    "style_sheet_missing": sheet is None,
                    "recognition_id": recognition.get("id"),
                    "postprocess": postprocess_meta(pp),
                    "provider": {
                        k: v
                        for k, v in (gen.metadata or {}).items()
                        if k != "prompt"
                    },
                    "client_doodle_id": request.client_doodle_id,
                    "doodle_bytes_in": len(doodle_png),
                    "doodle_source": doodle_source,
                    "has_client_raster": request.has_raster,
                    "has_strokes": request.has_strokes,
                    "final_bytes": len(pp.image_bytes),
                },
            )

    def _resolve_doodle(self, request: TransformRequest) -> tuple[bytes, str]:
        """Prefer client raster PNG (primary identity); fall back to stroke raster."""
        if request.doodle_png:
            return request.doodle_png, "client_png"
        if request.doodle_path:
            return Path(request.doodle_path).read_bytes(), "doodle_path"
        if request.strokes:
            from product.transform.raster import strokes_to_png_bytes

            return (
                strokes_to_png_bytes(
                    request.strokes,
                    size=int(request.options.size or 1024),
                ),
                "strokes_raster",
            )
        raise ValueError("no doodle input")

    def _maybe_persist(self, image_bytes: bytes, *, client_id: str | None, style: str) -> str | None:
        import os

        out_root = os.environ.get("DOOJI_OUT")
        if not out_root:
            return None
        safe_id = (client_id or "anon").replace("/", "_")[:64]
        path = Path(out_root) / safe_id / style / "final.png"
        write_png(image_bytes, path)
        return str(path)
