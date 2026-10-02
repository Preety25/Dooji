"""Postprocess + plush quality prompt regression tests (no xAI)."""
from __future__ import annotations

import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.transform.postprocess import remove_background, run_postprocess
from product.transform.prompt_compiler import compile_prompt, default_recognition
from product.transform.styles import load_style


def _rgba_png(w: int, h: int, paint) -> bytes:
    from PIL import Image

    im = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    px = im.load()
    paint(px, w, h)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def test_corner_flood_removes_white_backdrop() -> None:
    def paint(px, w, h):
        # Orange object in the center; pure white surrounds.
        for y in range(30, 70):
            for x in range(30, 70):
                px[x, y] = (220, 90, 40, 255)

    raw = _rgba_png(100, 100, paint)
    out, step = remove_background(raw, feather=0)
    assert step.startswith("bg_removal:corner_flood_removed_")
    from PIL import Image

    im = Image.open(io.BytesIO(out)).convert("RGBA")
    assert im.getpixel((0, 0))[3] == 0
    assert im.getpixel((99, 99))[3] == 0
    # Object interior stays opaque
    assert im.getpixel((50, 50))[3] == 255
    assert im.getpixel((50, 50))[:3] == (220, 90, 40)


def test_interior_white_not_connected_to_edge_preserved() -> None:
    def paint(px, w, h):
        # Colored ring with white belly fully enclosed (not edge-connected).
        for y in range(20, 80):
            for x in range(20, 80):
                px[x, y] = (40, 140, 220, 255)
        for y in range(35, 65):
            for x in range(35, 65):
                px[x, y] = (250, 250, 250, 255)

    raw = _rgba_png(100, 100, paint)
    out, _step = remove_background(raw, feather=0)
    from PIL import Image

    im = Image.open(io.BytesIO(out)).convert("RGBA")
    # Backdrop gone
    assert im.getpixel((0, 0))[3] == 0
    # Enclosed white belly remains opaque
    assert im.getpixel((50, 50))[3] == 255
    assert im.getpixel((50, 50))[0] >= 240


def test_run_postprocess_produces_transparent_canvas() -> None:
    def paint(px, w, h):
        for y in range(40, 60):
            for x in range(40, 60):
                px[x, y] = (30, 180, 90, 255)

    raw = _rgba_png(128, 128, paint)
    result = run_postprocess(raw, size=64)
    assert any(s.startswith("bg_removal:corner_flood") for s in result.steps)
    from PIL import Image

    im = Image.open(io.BytesIO(result.image_bytes)).convert("RGBA")
    assert im.size == (64, 64)
    assert im.getpixel((0, 0))[3] == 0


def test_soft_gray_plate_removed_like_gummy_failure() -> None:
    """Reproduce live gummy failure: ~215 gray plate + one white corner."""
    from PIL import Image

    def paint(px, w, h):
        # Soft gray gradient plate (not pure white / not >=230 everywhere).
        for y in range(h):
            for x in range(w):
                g = 215 + ((x + y) % 20)
                px[x, y] = (g, g, min(255, g + 2), 255)
        # Force one corner near-white like the live sample mix.
        px[0, h - 1] = (255, 255, 255, 255)
        # Saturated orange subject (gummy-like).
        for y in range(30, 70):
            for x in range(30, 70):
                px[x, y] = (236, 89, 9, 255)
        # Bright specular highlight inside subject (must survive).
        for y in range(40, 48):
            for x in range(40, 48):
                px[x, y] = (250, 250, 250, 255)

    raw = _rgba_png(100, 100, paint)
    out, step = remove_background(raw, feather=0)
    assert step.startswith("bg_removal:corner_flood_removed_"), step
    im = Image.open(io.BytesIO(out)).convert("RGBA")
    assert im.getpixel((0, 0))[3] == 0
    assert im.getpixel((99, 0))[3] == 0
    assert im.getpixel((0, 99))[3] == 0
    assert im.getpixel((99, 99))[3] == 0
    # Subject body + interior highlight preserved
    assert im.getpixel((50, 50))[3] == 255
    assert im.getpixel((50, 50))[:3] == (236, 89, 9)
    assert im.getpixel((44, 44))[3] == 255
    assert im.getpixel((44, 44))[0] >= 240


def test_gradient_near_white_plate_fully_cleared() -> None:
    """Glossy-like plate spanning ~230–255 must clear all corners."""
    from PIL import Image

    def paint(px, w, h):
        for y in range(h):
            for x in range(w):
                v = 230 + (x * 25) // max(1, w - 1)
                px[x, y] = (v, v, v, 255)
        for y in range(35, 65):
            for x in range(35, 65):
                px[x, y] = (252, 125, 22, 255)

    raw = _rgba_png(100, 100, paint)
    result = run_postprocess(raw, size=64)
    assert any(s.startswith("bg_removal:corner_flood") for s in result.steps)
    im = Image.open(io.BytesIO(result.image_bytes)).convert("RGBA")
    for x, y in ((0, 0), (63, 0), (0, 63), (63, 63)):
        assert im.getpixel((x, y))[3] == 0, (x, y, im.getpixel((x, y)))
    # Center of canvas should still contain opaque subject after normalize
    assert im.getpixel((32, 32))[3] > 200


def test_translucent_edge_color_not_eaten_as_plate() -> None:
    """Light but chromatic subject edge must not match gray plate removal."""
    from PIL import Image

    def paint(px, w, h):
        for y in range(h):
            for x in range(w):
                px[x, y] = (220, 220, 222, 255)
        # Pale orange rim (chromatic) touching near center — not on border.
        for y in range(25, 75):
            for x in range(25, 75):
                px[x, y] = (255, 190, 140, 255)
        for y in range(35, 65):
            for x in range(35, 65):
                px[x, y] = (240, 100, 20, 255)

    raw = _rgba_png(100, 100, paint)
    out, step = remove_background(raw, feather=0)
    assert step.startswith("bg_removal:corner_flood_removed_"), step
    im = Image.open(io.BytesIO(out)).convert("RGBA")
    assert im.getpixel((0, 0))[3] == 0
    # Pale orange rim preserved
    assert im.getpixel((30, 50))[3] == 255
    assert im.getpixel((30, 50))[0] >= 240
    assert im.getpixel((30, 50))[1] < 220


def test_plush_prompt_rejects_photoreal_and_requires_transparent() -> None:
    style = load_style("plush", root=ROOT)
    prompt = compile_prompt(style=style, recognition=default_recognition())
    lower = prompt.lower()
    assert "true transparent" in lower or "transparent cutout" in lower
    assert "never a white" in lower or "never white" in lower
    assert "photoreal" in lower
    assert "long individual hairs" in lower or "individual hairs" in lower
    assert "decal" in lower or "crayon" in lower or "outline" in lower
    assert "plush hard rule" in lower
    assert style.version.startswith("1.1")


def test_plush_look_line_is_stylized_not_fuzzy_photo() -> None:
    style = load_style("plush", root=ROOT)
    look = style.look_line.lower()
    assert "designer toy" in look or "soft sculpture" in look or "felted" in look
    assert "not photoreal" in look


def test_prompt_intent_preserving_reconstruction_doctrine() -> None:
    """Compiled prompts must follow transform-spec v1.2 reconstruction philosophy."""
    style = load_style("gummy", root=ROOT)
    prompt = compile_prompt(style=style, recognition=default_recognition())
    lower = prompt.lower()
    assert "preserve the decisions, not the mistakes" in lower
    assert "rough design sketch" in lower
    assert "reconstruct" in lower
    assert "semantic and expressive" in lower or "not pixel" in lower
    assert "generic canonical" in lower
    assert "creative anchors" in lower
    # Old strict-geometry philosophy must not dominate
    assert "keep the silhouette, major part count" not in lower
    assert "do not alter shape" not in lower
    assert "preserve exact" not in lower


def test_default_recognition_allows_level2_reconstruction() -> None:
    rec = default_recognition()
    allowed = " ".join(rec["allowed_completion"]).lower()
    assert "reconstruct" in allowed or "level 2" in allowed
    assert "inflate wobble" in allowed or "rough contours" in allowed
    forbidden = " ".join(rec["forbidden_additions"]).lower()
    assert "generic" in forbidden or "stock" in forbidden
    assert "expression" in forbidden or "pose" in forbidden


if __name__ == "__main__":
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"ok {fn.__name__}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"FAIL {fn.__name__}: {type(exc).__name__}: {exc}")
    print(f"passed {len(tests) - failed}/{len(tests)}")
    raise SystemExit(1 if failed else 0)
