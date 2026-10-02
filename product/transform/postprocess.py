"""Post-processing: generated → bg removal → alpha/edge → crop/normalize → PNG.

Background removal uses border-connected flood fill so interior light/white
object regions (belly, eyes, highlights) are preserved. No rembg/ML dependency.

Handles common xAI studio plates: near-white, soft gray gradients (~200–255),
and near-black voids. Does not treat checkerboard preview as transparency proof.
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


def _chroma(rgb: tuple[int, int, int]) -> int:
    return max(rgb) - min(rgb)


def _luma(rgb: tuple[int, int, int]) -> float:
    return (rgb[0] + rgb[1] + rgb[2]) / 3.0


def _is_plate_rgb(rgb: tuple[int, int, int]) -> bool:
    """Studio void / paper / soft-gray plate candidates (not subject paint)."""
    r, g, b = rgb
    luma = _luma(rgb)
    chroma = _chroma(rgb)
    # Near-black void
    if luma <= 18 and chroma <= 12:
        return True
    # Soft gray → white plates (covers gummy ~210–255 low-chroma gradients)
    if luma >= 200 and chroma <= 18:
        return True
    # Slightly darker soft gray sometimes used as seamless paper
    if luma >= 185 and chroma <= 12:
        return True
    # Classic near-white / cream (kept explicit for clarity)
    if r >= 245 and g >= 245 and b >= 245:
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


def _corners_fully_transparent(im: Any) -> bool:
    w, h = im.size
    px = im.load()
    corners = (
        px[0, 0][3],
        px[w - 1, 0][3],
        px[0, h - 1][3],
        px[w - 1, h - 1][3],
    )
    return all(a < 16 for a in corners)


def _sample_border_rgb(px: Any, w: int, h: int, step: int = 4) -> list[tuple[int, int, int]]:
    samples: list[tuple[int, int, int]] = []
    step = max(1, int(step))
    for x in range(0, w, step):
        samples.append(px[x, 0][:3])
        samples.append(px[x, h - 1][:3])
    for y in range(0, h, step):
        samples.append(px[0, y][:3])
        samples.append(px[w - 1, y][:3])
    return samples


def _median_channel(values: list[int]) -> int:
    s = sorted(values)
    return s[len(s) // 2]


def _estimate_backdrop(
    border: list[tuple[int, int, int]],
) -> tuple[tuple[int, int, int], int] | None:
    """Return (backdrop_rgb, tolerance) from border samples, or None if unclear."""
    plate = [c for c in border if _is_plate_rgb(c)]
    if len(border) == 0:
        return None
    # Require a clear majority of the border to look like a studio plate.
    if len(plate) < max(8, int(0.55 * len(border))):
        return None

    br = _median_channel([c[0] for c in plate])
    bg = _median_channel([c[1] for c in plate])
    bb = _median_channel([c[2] for c in plate])
    backdrop = (br, bg, bb)

    # Adaptive tolerance from plate spread (covers soft gray gradients).
    max_dist = 0
    for c in plate:
        d = int(_color_dist_sq(c, backdrop) ** 0.5)
        if d > max_dist:
            max_dist = d
    # Base 32 covers mild noise; expand with observed plate spread + margin.
    tolerance = max(32, max_dist + 12)
    # Cap so we don't wander into saturated subject colors.
    tolerance = min(tolerance, 72)
    return backdrop, tolerance


def _matches_backdrop(
    rgb: tuple[int, int, int],
    backdrop: tuple[int, int, int],
    tol_sq: int,
    *,
    loose: bool = False,
) -> bool:
    """Match plate pixels; avoid saturated / tinted subject colors."""
    if _color_dist_sq(rgb, backdrop) <= tol_sq:
        # Even if close in RGB distance, refuse strong chroma subject paint
        # unless the backdrop itself is chromatic (rare for studio voids).
        if _chroma(rgb) > 28 and _chroma(backdrop) <= 18:
            return False
        return True
    if not loose:
        return False
    # Loose residual pass: edge-connected soft shadow / gradient plate crumbs.
    # Must stay low-chroma and near backdrop luminance.
    if _chroma(rgb) > 16:
        return False
    if abs(_luma(rgb) - _luma(backdrop)) > 40:
        return False
    # Slightly wider RGB distance for residual crumbs only.
    return _color_dist_sq(rgb, backdrop) <= int(tol_sq * 1.85)


def remove_background(
    image_bytes: bytes,
    *,
    color_tolerance: int | None = None,
    feather: int = 1,
) -> tuple[bytes, str]:
    """Make border-connected studio backdrop transparent.

    Only removes pixels flood-filled from image borders that match the sampled
    plate color. Interior whites / highlights / translucent subject pixels that
    are not border-connected stay opaque.
    """
    if not _has_pillow():
        return image_bytes, "bg_removal:skipped_no_pillow"

    from PIL import Image, ImageFilter

    im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    if _has_useful_alpha(im) and _corners_fully_transparent(im):
        return image_bytes, "bg_removal:kept_existing_alpha"

    w, h = im.size
    if w < 2 or h < 2:
        return image_bytes, "bg_removal:too_small"

    px = im.load()
    border = _sample_border_rgb(px, w, h, step=max(1, min(w, h) // 256 or 1))
    estimated = _estimate_backdrop(border)
    if estimated is None:
        return image_bytes, "bg_removal:no_backdrop_detected"

    backdrop, adaptive_tol = estimated
    tolerance = int(color_tolerance) if color_tolerance is not None else adaptive_tol
    tol_sq = tolerance * tolerance

    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int, *, loose: bool = False) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if a < 16:
            visited[idx] = 1
            return
        if not _matches_backdrop((r, g, b), backdrop, tol_sq, loose=loose):
            return
        visited[idx] = 1
        queue.append((x, y))

    # Seed entire border (not just 4 corners) so gradient plates still start.
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
            nr, ng, nb, na = px[nx, ny]
            if na < 16:
                visited[nidx] = 1
                continue
            if not _matches_backdrop((nr, ng, nb), backdrop, tol_sq, loose=False):
                continue
            visited[nidx] = 1
            queue.append((nx, ny))

    # Residual pass: clear soft plate crumbs / soft shadows still border-touching.
    residual_queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            if visited[idx]:
                continue
            r, g, b, a = px[x, y]
            if a < 16:
                visited[idx] = 1
                continue
            if _matches_backdrop((r, g, b), backdrop, tol_sq, loose=True):
                visited[idx] = 1
                residual_queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            idx = y * w + x
            if visited[idx]:
                continue
            r, g, b, a = px[x, y]
            if a < 16:
                visited[idx] = 1
                continue
            if _matches_backdrop((r, g, b), backdrop, tol_sq, loose=True):
                visited[idx] = 1
                residual_queue.append((x, y))

    residual = 0
    while residual_queue:
        x, y = residual_queue.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        residual += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            nidx = ny * w + nx
            if visited[nidx]:
                continue
            nr, ng, nb, na = px[nx, ny]
            if na < 16:
                visited[nidx] = 1
                continue
            if not _matches_backdrop((nr, ng, nb), backdrop, tol_sq, loose=True):
                continue
            visited[nidx] = 1
            residual_queue.append((nx, ny))

    removed_total = removed + residual
    if removed_total == 0:
        return image_bytes, "bg_removal:no_pixels_removed"

    if feather > 0:
        # Soften cut edges without eroding the silhouette.
        alpha = im.getchannel("A")
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=float(feather)))
        im.putalpha(alpha)

    buf = io.BytesIO()
    im.save(buf, format="PNG")
    step = f"bg_removal:corner_flood_removed_{removed_total}"
    if residual:
        step += f"_residual_{residual}"
    return buf.getvalue(), step


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
        "Border-connected studio-plate removal; interior light regions preserved.",
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
