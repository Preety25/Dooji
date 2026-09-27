"""CI-safe production smoke + live-path wiring checks.

Default: no API credits (MockImageProvider).

Optional ONE live generation (spends credits — never in CI):
  IMAGE_PROVIDER=xai XAI_API_KEY=... DOOJI_LIVE=1 \\
    python3 -m tests.product.test_transform_smoke
"""
from __future__ import annotations

import base64
import os
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.api.app import handle_transform
from product.providers.mock import MockImageProvider
from product.providers.xai import XAIImageProvider
from product.transform.contracts import TransformOptions, TransformRequest
from product.transform.prompt_compiler import (
    EXECUTION_DOCTRINE,
    compile_prompt,
    default_recognition,
)
from product.transform.service import TransformService
from product.transform.styles import clear_style_cache, load_style, list_styles


def _tiny_png() -> bytes:
    """1×1 red RGBA PNG."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    raw = bytes([0, 255, 0, 0, 255])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def test_styles_as_data() -> None:
    clear_style_cache()
    ids = list_styles()
    assert set(ids) == {"gummy", "clay", "plush", "glossy"}
    g = load_style("gummy")
    assert g.version
    assert g.material_language
    assert "gelatin" in g.look_line.lower() or "gummy" in g.look_line.lower()
    sheet = g.resolve_sheet()
    assert sheet is not None and sheet.is_file(), "canonical gummy style sheet missing"
    for sid in ids:
        cfg = load_style(sid)
        assert cfg.resolve_sheet() is not None, f"missing sheet for {sid}"
        assert cfg.version


def test_prompt_compiler_doctrine() -> None:
    style = load_style("gummy")
    rec = default_recognition(client_doodle_id="u07")
    prompt = compile_prompt(style=style, recognition=rec, multi_image=True, n_style_refs=1)
    assert "SPECIAL (u07)" not in prompt
    assert "POLISH THE USER'S DOODLE" in prompt
    assert "Improve the execution, preserve the idea" in prompt
    assert "GUMMY" in prompt.upper()
    assert EXECUTION_DOCTRINE.split("\n", 1)[0] in prompt
    # Must not invent faces by default
    assert "no eyes" in prompt.lower() or "HARD BAN" in prompt


def test_transform_mock_with_raster_and_strokes() -> None:
    doodle = _tiny_png()
    strokes = {
        "canvas": {"width": 100, "height": 100},
        "strokes": [
            {
                "id": "s1",
                "points": [[10, 10], [50, 40], [80, 20]],
                "color": "#FF5577",
                "width": 6,
            }
        ],
    }
    svc = TransformService(provider=MockImageProvider())
    result = svc.transform(
        TransformRequest(
            style="gummy",
            doodle_png=doodle,
            strokes=strokes,
            client_doodle_id="smoke_raster",
            options=TransformOptions(size=64, dry_run=True),
        )
    )
    assert result.status in ("ok", "dry_run")
    assert result.provider == "mock"
    assert result.image_base64
    assert result.metadata.get("has_client_raster") is True
    assert result.metadata.get("has_strokes") is True
    assert result.metadata.get("doodle_source") == "client_png"
    assert result.metadata.get("style_sheet_missing") is False
    raw = base64.b64decode(result.image_base64)
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    blob = str(result.to_dict())
    assert "POLISH THE USER" not in blob
    assert "Improve the execution" not in blob


def test_api_handler_accepts_both() -> None:
    body = handle_transform(
        {
            "style": "gummy",
            "doodle_base64": base64.b64encode(_tiny_png()).decode("ascii"),
            "strokes": {
                "canvas": {"width": 64, "height": 64},
                "strokes": [
                    {"id": "a", "points": [[1, 1], [2, 2]], "color": "#000000"}
                ],
            },
            "client_doodle_id": "api_both",
            "options": {"dry_run": True, "size": 64},
        }
    )
    assert body["status"] in ("ok", "dry_run")
    assert body["style"] == "gummy"
    assert body.get("image_base64")
    assert "XAI_API_KEY" not in str(body)
    assert body.get("metadata", {}).get("has_client_raster") is True


def test_xai_provider_skips_without_key() -> None:
    """Live path must fail closed when key unset — no network, no credit spend."""
    prev = os.environ.pop("XAI_API_KEY", None)
    try:
        provider = XAIImageProvider()
        from product.providers.base import ProviderGenerateRequest

        res = provider.generate(
            ProviderGenerateRequest(doodle_png=_tiny_png(), prompt="test")
        )
        assert res.ok is False
        assert "XAI_API_KEY" in (res.error or "")
    finally:
        if prev is not None:
            os.environ["XAI_API_KEY"] = prev


def test_xai_wired_through_service_fail_closed() -> None:
    """Prove TransformService → XAIImageProvider wiring without spending credits."""
    prev = os.environ.pop("XAI_API_KEY", None)
    try:
        svc = TransformService(provider=XAIImageProvider(resolution="1k", quality="low"))
        result = svc.transform(
            TransformRequest(
                style="gummy",
                doodle_png=_tiny_png(),
                client_doodle_id="wire_check",
                options=TransformOptions(size=64),
            )
        )
        assert result.status == "error"
        assert result.provider == "xai"
        assert "XAI_API_KEY" in (result.error or "")
    finally:
        if prev is not None:
            os.environ["XAI_API_KEY"] = prev


def optional_live() -> None:
    """Only when DOOJI_LIVE=1 and XAI_API_KEY set — ONE gummy 1k/low/n=1 call."""
    if os.environ.get("DOOJI_LIVE") != "1":
        print("skip live: set DOOJI_LIVE=1 to spend credits (use scripts/run_live_gummy_once.py)")
        return
    if not os.environ.get("XAI_API_KEY"):
        print("skip live: XAI_API_KEY unset")
        return
    # Prefer a real tiny doodle from lab pack if present
    candidates = [
        ROOT / "out" / "v4" / "v42" / "unseen" / "inputs_api" / "u01.png",
        ROOT / "docs" / "refs" / "ref4_kawaii_heart.png",
    ]
    doodle = None
    for c in candidates:
        if c.is_file():
            doodle = c.read_bytes()
            break
    if doodle is None:
        doodle = _tiny_png()
    svc = TransformService(provider=XAIImageProvider(resolution="1k", quality="low"))
    result = svc.transform(
        TransformRequest(
            style="gummy",
            doodle_png=doodle,
            client_doodle_id="live_smoke",
            options=TransformOptions(size=1024),
        )
    )
    print("live_status=", result.status, "provider=", result.provider, "error=", result.error)
    assert result.status == "ok", result.error
    assert result.image_base64
    assert result.provider == "xai"


def main() -> int:
    test_styles_as_data()
    print("ok styles + sheets")
    test_prompt_compiler_doctrine()
    print("ok prompt doctrine")
    test_transform_mock_with_raster_and_strokes()
    print("ok transform mock raster+strokes")
    test_api_handler_accepts_both()
    print("ok api both fields")
    test_xai_provider_skips_without_key()
    print("ok xai skip-without-key")
    test_xai_wired_through_service_fail_closed()
    print("ok xai service wiring")
    optional_live()
    print("ALL SMOKE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
