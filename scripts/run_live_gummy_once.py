#!/usr/bin/env python3
"""ONE live Gummy generation via product transform → XAIImageProvider.

Spends credits. Do not batch. Defaults: style=gummy, resolution=1k, quality=low, n=1.

Usage (repo root):
  export XAI_API_KEY=...
  export IMAGE_PROVIDER=xai
  export DOOJI_LIVE=1
  export DOOJI_OUT=out/product/live_slice   # optional persist
  python3 -m scripts.run_live_gummy_once

Optional:
  DOOJI_LIVE_DOODLE=/path/to/doodle.png   # default: tiny synthetic heart-ish doodle
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _synthetic_doodle_png(size: int = 512) -> bytes:
    """Simple colored doodle PNG (not a curated mock result)."""
    from PIL import Image, ImageDraw

    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Messy heart-ish doodle — imperfect contours intentionally
    cx, cy = size // 2, size // 2 + 20
    pts = []
    import math

    for i in range(48):
        t = i / 47 * math.pi * 2
        # classic heart parametric + wobble
        x = 16 * math.sin(t) ** 3
        y = (
            13 * math.cos(t)
            - 5 * math.cos(2 * t)
            - 2 * math.cos(3 * t)
            - math.cos(4 * t)
        )
        wobble = 1.0 + 0.08 * math.sin(5 * t)
        px = cx + x * (size * 0.018) * wobble
        py = cy - y * (size * 0.018) * wobble
        pts.append((px, py))
    d.line(pts + [pts[0]], fill=(255, 70, 120, 255), width=max(8, size // 40), joint="curve")
    # interior squiggle (surface mark)
    d.line(
        [
            (cx - size * 0.08, cy - size * 0.02),
            (cx, cy + size * 0.05),
            (cx + size * 0.08, cy - size * 0.02),
        ],
        fill=(220, 40, 90, 255),
        width=max(4, size // 80),
        joint="curve",
    )
    import io

    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def main() -> int:
    if os.environ.get("DOOJI_LIVE") != "1":
        print("Refusing to spend credits: set DOOJI_LIVE=1")
        return 2
    if not os.environ.get("XAI_API_KEY"):
        print("BLOCKER: XAI_API_KEY unset — live path not runnable in this environment.")
        print("Set XAI_API_KEY and re-run. Path is fully wired (see docs).")
        return 2

    os.environ.setdefault("IMAGE_PROVIDER", "xai")

    from product.providers.xai import XAIImageProvider
    from product.transform.contracts import TransformOptions, TransformRequest
    from product.transform.service import TransformService
    from product.transform.styles import load_style

    style = load_style("gummy")
    sheet = style.resolve_sheet()
    print(f"style={style.id} v{style.version} sheet={sheet}")

    doodle_path = os.environ.get("DOOJI_LIVE_DOODLE")
    if doodle_path and Path(doodle_path).is_file():
        doodle = Path(doodle_path).read_bytes()
        print(f"doodle_source=file:{doodle_path} bytes={len(doodle)}")
    else:
        doodle = _synthetic_doodle_png(512)
        print(f"doodle_source=synthetic_heart bytes={len(doodle)}")

    # Explicit 1k / low / n=1 — never batch
    provider = XAIImageProvider(resolution="1k", quality="low")
    svc = TransformService(provider=provider)
    result = svc.transform(
        TransformRequest(
            style="gummy",
            doodle_png=doodle,
            strokes=None,
            client_doodle_id="live_vertical_slice_gummy",
            options=TransformOptions(size=1024, dry_run=False),
        )
    )
    print(
        "status=", result.status,
        "provider=", result.provider,
        "model=", result.model,
        "error=", result.error,
    )
    print("meta=", {k: result.metadata.get(k) for k in (
        "style_sheet", "style_version", "doodle_source", "prompt_len", "final_bytes", "postprocess"
    )})
    if result.status != "ok" or not result.image_base64:
        return 1
    out = Path(os.environ.get("DOOJI_OUT") or "out/product/live_slice")
    out.mkdir(parents=True, exist_ok=True)
    png = out / "gummy_live.png"
    import base64

    png.write_bytes(base64.b64decode(result.image_base64))
    print("wrote", png)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
