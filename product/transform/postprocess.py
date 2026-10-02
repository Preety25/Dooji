"""Post-processing: generated → bg removal → alpha/edge → crop/normalize → PNG.

Background removal uses corner-connected flood fill so interior light/white
object regions (belly, eyes, highlights) are preserved. No rembg/ML dependency.
"""
from __future__ import annotations

import io
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class PostProcessResult:
    image_bytes: bytes
    steps: list[str]
    notes: list[str]


def _has_pillow() -> bool:
    try:
        import PIL  # noqa: F401

        return True
    except ImportError:
        return False


def _color_dist_sq(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def _is_backdrop_rgb(rgb: tuple[int, int, int]) -> bool:
    """Near-white / light-gray / near-black studio voids commonly returned by models."""
    r, g, b = rgb
    # Near white / cream paper
    if r >= 245 and g >= 245 and b >= 245:
        return True
    # Soft light gray / off-white
    if r >= 230 and g >= 230 and b >= 230 and max(r, g, b) - min(r, g, b) <= 12:
        return True
    # Near black void
    if r <= 12 and g <= 12 and b <= 12:
        return True
    return False


def _has_useful_alpha(im: Any) -> bool:
    """True when the image already has meaningful transparency (not fully opaque)."""
    if im.mode not in ("RGBA", "LA"):
        return False
    alpha = im.getchannel("A")
    extrema = alpha.getextrema()
    if not extrema:
        return False
    return extrema[0] < 250


def remove_background(
    image_bytes: bytes,
    *,
    color_tolerance: int = 28,
    feather: int = 1,
) -> tuple[bytes, str]:
    """Make corner-connected backdrop transparent.

    Only removes pixels flood-filled from image borders that match a backdrop
    color (near-white / light-gray / near-black). Interior whites stay opaque.
    If the PNG already has useful alpha, pass through unchanged.
    """
    if not _has_pillow():
        return image_bytes, "bg_removal:skipped_no_pillow"

    from PIL import Image, ImageFilter

    im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    if _has_useful_alpha(im):
        return image_bytes, "bg_removal:kept_existing_alpha"

    w, h = im.size
    if w < 2 or h < 2:
        return image_bytes, "bg_removal:too_small"

    px = im.load()
    corners = [
        px[0, 0][:3],
        px[w - 1, 0][:3],
        px[0, h - 1][:3],
        px[w - 1, h - 1][:3],
    ]
    backdrop_seeds = [c for c in corners if _is_backdrop_rgb(c)]
    if len(backdrop_seeds) < 2:
        # Not a clear studio void — leave intact rather than guess.
        return image_bytes, "bg_removal:no_backdrop_detected"

    # Representative backdrop = median of seed corners
    br = sorted(c[0] for c in backdrop_seeds)[len(backdrop_seeds) // 2]
    bg = sorted(c[1] for c in backdrop_seeds)[len(backdrop_seeds) // 2]
    bb = sorted(c[2] for c in backdrop_seeds)[len(backdrop_seeds) // 2]
    backdrop = (br, bg, bb)
    tol_sq = color_tolerance * color_tolerance

    def matches(rgb: tuple[int, int, int]) -> bool:
        # Strict: only pixels close to the sampled backdrop. Do NOT treat all
        # near-white pixels as bg (that would erase white belly/eyes interiors
        # once they touch the void — flood connectivity already limits damage).
        return _color_dist_sq(rgb, backdrop) <= tol_sq

    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, _a = px[x, y]
        if not matches((r, g, b)):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    removed = 0
    while queue:
        x, y = queue.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            nidx = ny * w + nx
            if visited[nidx]:
                continue
            nr, ng, nb, _na = px[nx, ny]
            if not matches((nr, ng, nb)):
                continue
            visited[nidx] = 1
            queue.append((nx, ny))

    if removed == 0:
        return image_bytes, "bg_removal:no_pixels_removed"

    if feather > 0:
        # Soften cut edges without eroding the silhouette.
        alpha = im.getchannel("A")
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=float(feather)))
        im.putalpha(alpha)

    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue(), f"bg_removal:corner_flood_removed_{removed}"


def ensure_alpha_edges(image_bytes: bytes) -> tuple[bytes, str]:
    """If Pillow available, ensure RGBA. No aggressive edge rewrite."""
    if not _has_pillow():
        return image_bytes, "alpha_edge:skipped_no_pillow"
    from PIL import Image

    im = Image.open(io.BytesIO(image_bytes))
    if im.mode != "RGBA":
        im = im.convert("RGBA")
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        return buf.getvalue(), "alpha_edge:converted_rgba"
    return image_bytes, "alpha_edge:already_rgba"


def crop_and_normalize(
    image_bytes: bytes,
    *,
    size: int = 1024,
) -> tuple[bytes, str]:
    """Square letterbox/normalize to ``size`` when Pillow is available."""
    if not _has_pillow():
        return image_bytes, "crop_normalize:skipped_no_pillow"
    from PIL import Image

    im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = min(size / max(w, 1), size / max(h, 1))
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2), im)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue(), f"crop_normalize:square_{size}"


def run_postprocess(
    image_bytes: bytes,
    *,
    size: int = 1024,
    skip: bool = False,
) -> PostProcessResult:
    """Postprocess pipeline. ``skip=True`` returns bytes unchanged (dry-run / mock)."""
    if skip:
        return PostProcessResult(
            image_bytes=image_bytes,
            steps=["skipped"],
            notes=["postprocess skipped"],
        )
    steps: list[str] = []
    notes: list[str] = [
        "Corner-connected backdrop removal; interior light regions preserved.",
    ]
    out, step = remove_background(image_bytes)
    steps.append(step)
    out, step = ensure_alpha_edges(out)
    steps.append(step)
    out, step = crop_and_normalize(out, size=size)
    steps.append(step)
    return PostProcessResult(image_bytes=out, steps=steps, notes=notes)


def write_png(image_bytes: bytes, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(image_bytes)
    return path


def postprocess_meta(result: PostProcessResult) -> dict[str, Any]:
    return {"steps": result.steps, "notes": result.notes}
