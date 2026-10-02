"""Production hardening — limits, kill switch, dry_run/path lockdown, port, provider config."""
from __future__ import annotations

import base64
import json
import os
import struct
import sys
import zlib
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.api.app import (
    PayloadTooLarge,
    TransformHandler,
    handle_transform,
    parse_transform_body,
)
from product.policy.generation_policy import (
    InMemoryGenerationPolicy,
    reset_generation_policy_for_tests,
)
from product.providers import get_provider
from product.runtime import resolve_bind_port


def _tiny_png() -> bytes:
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


def _payload(**extra):
    body = {
        "style": "gummy",
        "doodle_base64": base64.b64encode(_tiny_png()).decode("ascii"),
        "anonymous_client_id": "harden-client",
    }
    body.update(extra)
    return body


def _clear_env(*keys: str) -> dict[str, str | None]:
    prev = {k: os.environ.get(k) for k in keys}
    for k in keys:
        os.environ.pop(k, None)
    return prev


def _restore_env(prev: dict[str, str | None]) -> None:
    for k, v in prev.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


def test_kill_switch_rejects_without_quota() -> None:
    prev = _clear_env("DOOJI_GENERATIONS_DISABLED", "DOOJI_ENV")
    os.environ["DOOJI_GENERATIONS_DISABLED"] = "1"
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    try:
        body = handle_transform(_payload(), policy=pol, provider_name="mock")
        assert body["status"] == "error"
        assert body["error"] == "generations_disabled"
        assert pol.audit_log() == []
        assert pol.check(client_id="harden-client").allowed
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_kill_switch_off_allows_mock_generation() -> None:
    prev = _clear_env("DOOJI_GENERATIONS_DISABLED", "DOOJI_ENV")
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    try:
        body = handle_transform(_payload(), policy=pol, provider_name="mock")
        assert body["status"] == "ok"
        kinds = [e["kind"] for e in pol.audit_log()]
        assert "provider_attempt" in kinds
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_production_rejects_dry_run() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_DEV_TOOLS")
    os.environ["DOOJI_ENV"] = "production"
    try:
        try:
            parse_transform_body(
                {
                    **_payload(),
                    "options": {"dry_run": True},
                }
            )
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "dry_run" in str(exc).lower()
    finally:
        _restore_env(prev)


def test_dev_dry_run_still_skips_quota() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_GENERATIONS_DISABLED")
    pol = InMemoryGenerationPolicy(anon_limit=1, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    try:
        body = handle_transform(
            {**_payload(), "options": {"dry_run": True}},
            policy=pol,
            provider_name="mock",
        )
        assert body["status"] in ("ok", "dry_run")
        assert pol.check(client_id="harden-client").allowed
        assert not any(e["kind"] == "provider_attempt" for e in pol.audit_log())
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_production_rejects_doodle_path() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_DEV_TOOLS", "DOOJI_ALLOW_DOODLE_PATH")
    os.environ["DOOJI_ENV"] = "production"
    try:
        try:
            parse_transform_body(
                {
                    "style": "gummy",
                    "doodle_path": "/etc/passwd",
                }
            )
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "doodle_path" in str(exc).lower()
    finally:
        _restore_env(prev)


def test_doodle_path_traversal_rejected_even_in_dev() -> None:
    prev = _clear_env("DOOJI_ENV")
    os.environ["DOOJI_DEV_TOOLS"] = "1"
    try:
        try:
            parse_transform_body(
                {
                    "style": "gummy",
                    "doodle_path": "../../etc/passwd",
                }
            )
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "invalid" in str(exc).lower() or "doodle_path" in str(exc).lower()
    finally:
        _restore_env(prev)
        os.environ.pop("DOOJI_DEV_TOOLS", None)


def test_oversized_image_rejected_no_quota() -> None:
    prev = _clear_env("DOOJI_ENV", "DOOJI_MAX_IMAGE_BYTES")
    os.environ["DOOJI_MAX_IMAGE_BYTES"] = "32"
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    try:
        try:
            handle_transform(_payload(), policy=pol, provider_name="mock")
            assert False, "expected PayloadTooLarge"
        except PayloadTooLarge:
            pass
        assert pol.audit_log() == []
        assert pol.check(client_id="harden-client").allowed
    finally:
        reset_generation_policy_for_tests(None)
        _restore_env(prev)


def test_excessive_strokes_rejected() -> None:
    prev = _clear_env("DOOJI_MAX_STROKES")
    os.environ["DOOJI_MAX_STROKES"] = "2"
    try:
        try:
            parse_transform_body(
                {
                    "style": "gummy",
                    "doodle_base64": base64.b64encode(_tiny_png()).decode("ascii"),
                    "strokes": [{}, {}, {}],
                }
            )
            assert False, "expected PayloadTooLarge"
        except PayloadTooLarge:
            pass
    finally:
        _restore_env(prev)


def test_http_body_limit_returns_413() -> None:
    prev = _clear_env("DOOJI_MAX_BODY_BYTES", "DOOJI_DEV_TOOLS", "DOOJI_ENV")
    os.environ["DOOJI_MAX_BODY_BYTES"] = "64"
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), TransformHandler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    port = httpd.server_address[1]
    try:
        raw = json.dumps(_payload()).encode("utf-8")
        req = Request(
            f"http://127.0.0.1:{port}/v1/transform",
            data=raw,
            method="POST",
            headers={"Content-Type": "application/json", "Content-Length": str(len(raw))},
        )
        try:
            urlopen(req, timeout=5)
            assert False, "expected HTTPError"
        except HTTPError as exc:
            assert exc.code == 413
            body = json.loads(exc.read().decode("utf-8"))
            assert body["error"] == "payload_too_large"
        except OSError:
            # Some Windows stacks abort the socket after 413; still proves rejection.
            pass
    finally:
        httpd.shutdown()
        _restore_env(prev)


def test_dev_reset_404_when_disabled_and_in_production() -> None:
    prev = _clear_env("DOOJI_DEV_TOOLS", "DOOJI_ENV")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["DOOJI_DEV_TOOLS"] = "1"  # even if mistakenly set
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), TransformHandler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    port = httpd.server_address[1]
    try:
        req = Request(
            f"http://127.0.0.1:{port}/v1/dev/reset-quota",
            data=b'{"all":true}',
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            urlopen(req, timeout=5)
            assert False, "expected HTTPError"
        except HTTPError as exc:
            assert exc.code == 404
    finally:
        httpd.shutdown()
        _restore_env(prev)


def test_production_provider_rejects_mock() -> None:
    prev = _clear_env("DOOJI_ENV", "IMAGE_PROVIDER", "XAI_API_KEY")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["IMAGE_PROVIDER"] = "mock"
    try:
        try:
            get_provider()
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "mock" in str(exc).lower()
    finally:
        _restore_env(prev)


def test_production_provider_requires_key() -> None:
    prev = _clear_env("DOOJI_ENV", "IMAGE_PROVIDER", "XAI_API_KEY")
    os.environ["DOOJI_ENV"] = "production"
    os.environ["IMAGE_PROVIDER"] = "xai"
    try:
        try:
            get_provider()
            assert False, "expected ValueError"
        except ValueError as exc:
            assert "XAI_API_KEY" in str(exc)
    finally:
        _restore_env(prev)


def test_resolve_bind_port_prefers_dooji_then_platform() -> None:
    prev = _clear_env("DOOJI_PORT", "PORT")
    try:
        assert resolve_bind_port() == 8080
        os.environ["PORT"] = "3000"
        assert resolve_bind_port() == 3000
        os.environ["DOOJI_PORT"] = "9090"
        assert resolve_bind_port() == 9090
    finally:
        _restore_env(prev)


def test_quota_unchanged_six_then_block() -> None:
    prev = _clear_env("DOOJI_GENERATIONS_DISABLED", "DOOJI_ENV")
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    for i in range(6):
        assert pol.check(client_id="q").allowed
        pol.record_provider_attempt(client_id="q", style="gummy")
    assert not pol.check(client_id="q").allowed
    _restore_env(prev)


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
    if failed:
        raise SystemExit(1)
    print(f"passed {len(tests)}")
