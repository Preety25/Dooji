"""GenerationPolicy unit tests — quota, rolling window, cache-hit exemption, global budget."""
from __future__ import annotations

import json
import os
import sys
import time
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.api.app import handle_dev_reset_quota, handle_transform
from product.api.app import TransformHandler
from product.policy.generation_policy import (
    InMemoryGenerationPolicy,
    reset_dev_quota,
    reset_generation_policy_for_tests,
)
import base64
import struct
import zlib


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


def test_six_allowed_seventh_blocked() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    client = "anon-test-a"
    for i in range(6):
        d = pol.check(client_id=client)
        assert d.allowed, f"attempt {i+1} should be allowed"
        pol.record_provider_attempt(client_id=client, style="gummy")
    blocked = pol.check(client_id=client)
    assert not blocked.allowed
    assert blocked.reason == "rate_limited"
    assert blocked.reset_at is not None
    assert "Try again later" in (blocked.message or "")


def test_rolling_window_expiry() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=2, global_daily=1000, window_seconds=0.15)
    client = "anon-window"
    pol.record_provider_attempt(client_id=client)
    pol.record_provider_attempt(client_id=client)
    assert not pol.check(client_id=client).allowed
    time.sleep(0.2)
    assert pol.check(client_id=client).allowed


def test_cache_hit_does_not_count() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=1, global_daily=1000)
    client = "anon-cache"
    pol.record_cache_hit(client_id=client, style="gummy")
    pol.record_cache_hit(client_id=client, style="clay")
    assert pol.check(client_id=client).allowed
    kinds = [e["kind"] for e in pol.audit_log()]
    assert kinds.count("cache_hit") == 2
    assert "provider_attempt" not in kinds


def test_global_budget_blocks_provider_not_checked_for_cache() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=100, global_daily=2)
    for i in range(2):
        pol.record_provider_attempt(client_id=f"c{i}")
    d = pol.check(client_id="c3")
    assert not d.allowed
    assert d.reason == "global_budget_blocked"
    # cache hit recording still allowed (no provider)
    pol.record_cache_hit(client_id="c3", style="plush")
    assert any(e["kind"] == "cache_hit" for e in pol.audit_log())


def test_handle_transform_rate_limited_never_calls_provider() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=0, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    b64 = base64.b64encode(_tiny_png()).decode("ascii")
    body = handle_transform(
        {
            "style": "gummy",
            "doodle_base64": b64,
            "anonymous_client_id": "blocked-user",
            "options": {"dry_run": False},
        },
        policy=pol,
        provider_name="mock",
    )
    assert body["status"] == "rate_limited"
    assert body["metadata"]["reason"] == "rate_limited"
    assert "message" in body["metadata"]
    # no successful_generation audit
    kinds = [e["kind"] for e in pol.audit_log()]
    assert "successful_generation" not in kinds
    assert "rate_limited" in kinds
    reset_generation_policy_for_tests(None)


def test_dry_run_skips_quota() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=0, global_daily=0)
    b64 = base64.b64encode(_tiny_png()).decode("ascii")
    body = handle_transform(
        {
            "style": "gummy",
            "doodle_base64": b64,
            "anonymous_client_id": "dry",
            "options": {"dry_run": True},
        },
        policy=pol,
        provider_name="mock",
    )
    assert body["status"] in ("ok", "dry_run")
    assert not any(e["kind"] == "provider_attempt" for e in pol.audit_log())


def test_ip_secondary_limit() -> None:
    pol = InMemoryGenerationPolicy(
        anon_limit=100, global_daily=1000, ip_burst_limit=3
    )
    for i in range(3):
        pol.record_provider_attempt(client_id=f"u{i}", ip="10.0.0.9")
    d = pol.check(client_id="u-new", ip="10.0.0.9")
    assert not d.allowed
    assert d.reason == "rate_limited"


def test_dev_reset_allows_same_client_again() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=6, global_daily=1000)
    client = "anon-qa-reset"
    for _ in range(6):
        assert pol.check(client_id=client).allowed
        pol.record_provider_attempt(client_id=client, style="gummy")
    assert not pol.check(client_id=client).allowed

    result = reset_dev_quota(client_id=client, policy=pol)
    assert result["ok"] is True
    assert result["scope"] == "client"
    assert pol.check(client_id=client).allowed
    assert pol.check(client_id=client).remaining == 6


def test_dev_reset_all_clears_ip_and_global() -> None:
    pol = InMemoryGenerationPolicy(
        anon_limit=2, global_daily=2, ip_burst_limit=2
    )
    pol.record_provider_attempt(client_id="a", ip="1.1.1.1")
    pol.record_provider_attempt(client_id="b", ip="1.1.1.1")
    assert not pol.check(client_id="c", ip="1.1.1.1").allowed

    result = reset_dev_quota(reset_all=True, policy=pol)
    assert result["scope"] == "all"
    assert pol.check(client_id="c", ip="1.1.1.1").allowed


def test_cache_hit_still_zero_quota_after_reset() -> None:
    pol = InMemoryGenerationPolicy(anon_limit=1, global_daily=1000)
    client = "anon-cache-after-reset"
    pol.record_provider_attempt(client_id=client, style="gummy")
    assert not pol.check(client_id=client).allowed
    reset_dev_quota(client_id=client, policy=pol)
    pol.record_cache_hit(client_id=client, style="gummy")
    pol.record_cache_hit(client_id=client, style="clay")
    d = pol.check(client_id=client)
    assert d.allowed
    assert d.remaining == 1
    kinds = [e["kind"] for e in pol.audit_log()]
    assert kinds.count("cache_hit") == 2


def test_handle_dev_reset_requires_dev_tools_env() -> None:
    prev = os.environ.pop("DOOJI_DEV_TOOLS", None)
    try:
        body = handle_dev_reset_quota({"all": True})
        assert body["ok"] is False
        assert body["error"] == "dev_tools_disabled"
    finally:
        if prev is not None:
            os.environ["DOOJI_DEV_TOOLS"] = prev


def test_http_reset_quota_404_without_dev_tools() -> None:
    prev = os.environ.pop("DOOJI_DEV_TOOLS", None)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), TransformHandler)
    port = httpd.server_address[1]
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        req = Request(
            f"http://127.0.0.1:{port}/v1/dev/reset-quota",
            data=b'{"all":true}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urlopen(req, timeout=5)
            raise AssertionError("expected HTTP 404")
        except HTTPError as exc:
            assert exc.code == 404
    finally:
        httpd.shutdown()
        if prev is not None:
            os.environ["DOOJI_DEV_TOOLS"] = prev


def test_http_reset_quota_works_with_dev_tools() -> None:
    prev = os.environ.get("DOOJI_DEV_TOOLS")
    os.environ["DOOJI_DEV_TOOLS"] = "1"
    pol = InMemoryGenerationPolicy(anon_limit=1, global_daily=1000)
    reset_generation_policy_for_tests(pol)
    for _ in range(1):
        pol.record_provider_attempt(client_id="http-reset", style="gummy")
    assert not pol.check(client_id="http-reset").allowed

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), TransformHandler)
    port = httpd.server_address[1]
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        req = Request(
            f"http://127.0.0.1:{port}/v1/dev/reset-quota",
            data=json.dumps({"anonymous_client_id": "http-reset"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=5) as res:
            body = json.loads(res.read().decode())
        assert body["ok"] is True
        assert body["dev_only"] is True
        assert pol.check(client_id="http-reset").allowed
    finally:
        httpd.shutdown()
        reset_generation_policy_for_tests(None)
        if prev is None:
            os.environ.pop("DOOJI_DEV_TOOLS", None)
        else:
            os.environ["DOOJI_DEV_TOOLS"] = prev


if __name__ == "__main__":
    test_six_allowed_seventh_blocked()
    test_rolling_window_expiry()
    test_cache_hit_does_not_count()
    test_global_budget_blocks_provider_not_checked_for_cache()
    test_handle_transform_rate_limited_never_calls_provider()
    test_dry_run_skips_quota()
    test_ip_secondary_limit()
    test_dev_reset_allows_same_client_again()
    test_dev_reset_all_clears_ip_and_global()
    test_cache_hit_still_zero_quota_after_reset()
    test_handle_dev_reset_requires_dev_tools_env()
    test_http_reset_quota_404_without_dev_tools()
    test_http_reset_quota_works_with_dev_tools()
    print("generation_policy ok")
