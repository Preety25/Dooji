"""Minimal HTTP surface for POST /v1/transform.

Stdlib only — no Flask/FastAPI required for the MVP foundation.
Prompts, style sheets, and provider keys never leave the server.
"""
from __future__ import annotations

import base64
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from product.policy import get_generation_policy
from product.policy.generation_policy import (
    dev_tools_enabled,
    reset_dev_quota,
)
from product.providers import get_provider
from product.transform.contracts import TransformOptions, TransformRequest
from product.transform.service import TransformService


def parse_transform_body(payload: dict[str, Any]) -> TransformRequest:
    """Map JSON body → TransformRequest.

    Live clients should send **both** raster + strokes:
      - doodle_base64 / doodle_png_base64  (primary identity PNG)
      - strokes                            (canonical stroke JSON)
      - style

    Accepted image fields (first wins for raster bytes):
      - doodle_base64 / doodle_png_base64
      - doodle_path (server-local; useful for smoke / ops)
      - strokes alone (server raster fallback via lab.v3.raster)
    """
    opts_raw = payload.get("options") or {}
    options = TransformOptions(
        size=int(opts_raw.get("size") or 1024),
        dry_run=bool(opts_raw.get("dry_run") or False),
        recognition=opts_raw.get("recognition"),
    )
    doodle_png = None
    b64 = payload.get("doodle_base64") or payload.get("doodle_png_base64")
    if b64:
        if isinstance(b64, str) and "," in b64 and b64.strip().startswith("data:"):
            b64 = b64.split(",", 1)[1]
        doodle_png = base64.b64decode(b64)

    return TransformRequest(
        style=str(payload.get("style") or ""),
        doodle_png=doodle_png,
        doodle_path=payload.get("doodle_path"),
        strokes=payload.get("strokes"),
        client_doodle_id=payload.get("client_doodle_id"),
        options=options,
    )


def handle_transform(
    payload: dict[str, Any],
    *,
    provider_name: str | None = None,
    client_id: str | None = None,
    client_ip: str | None = None,
    policy=None,
) -> dict[str, Any]:
    """Core handler used by HTTP stub and unit tests.

    Flow: parse → GenerationPolicy (cache is client-side) → provider → response.
    Cache hits never reach this handler from a well-behaved client.
    """
    req = parse_transform_body(payload)
    anon_id = (
        client_id
        or payload.get("anonymous_client_id")
        or payload.get("client_id")
        or "anonymous"
    )
    ip = client_ip or payload.get("client_ip")
    pol = policy if policy is not None else get_generation_policy()

    # dry_run skips quota — used for smoke / CI without burning budget
    if not req.options.dry_run:
        decision = pol.check(client_id=str(anon_id), ip=ip)
        if not decision.allowed:
            return {
                "status": "rate_limited",
                "style": req.style,
                "transform_version": "product.mvp.v1",
                "error": decision.reason,
                "metadata": {
                    "reason": decision.reason,
                    "remaining": decision.remaining,
                    "reset_at": decision.reset_at,
                    "message": decision.message
                    or "You've reached your generation limit for now. Try again later.",
                },
            }

    provider = get_provider(provider_name) if provider_name else get_provider(
        "mock" if req.options.dry_run else None
    )
    if req.options.dry_run:
        provider = get_provider("mock")

    if not req.options.dry_run:
        pol.record_provider_attempt(
            client_id=str(anon_id), ip=ip, style=req.style
        )

    result = TransformService(provider=provider).transform(req)
    body = result.to_dict(include_image_base64=True)

    if not req.options.dry_run:
        if body.get("status") in ("ok", "dry_run"):
            pol.record_success(client_id=str(anon_id), ip=ip, style=req.style)
        else:
            pol.record_failure(
                client_id=str(anon_id),
                ip=ip,
                style=req.style,
                error=str(body.get("error") or "provider_failure"),
            )

    return body


def handle_dev_reset_quota(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """DEV-ONLY: clear GenerationPolicy counters for local QA.

    Requires ``DOOJI_DEV_TOOLS=1``. Does not touch Library / creations / cache assets.
    """
    if not dev_tools_enabled():
        return {"ok": False, "error": "dev_tools_disabled"}
    body = payload or {}
    reset_all = bool(body.get("all") or body.get("reset_all"))
    client_id = body.get("anonymous_client_id") or body.get("client_id") or None
    if isinstance(client_id, str):
        client_id = client_id.strip() or None
    result = reset_dev_quota(client_id=client_id, reset_all=reset_all or not client_id)
    return {
        "ok": True,
        "dev_only": True,
        "message": "Local generation quota reset. Library data unchanged.",
        **result,
    }


class TransformHandler(BaseHTTPRequestHandler):
    server_version = "DoojiTransform/0.1"

    def log_message(self, fmt: str, *args) -> None:  # noqa: N802
        sys_stderr_write = getattr(self, "_quiet", False)
        if sys_stderr_write:
            return
        super().log_message(fmt, *args)

    def _send(self, code: int, obj: dict) -> None:
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/health", "/v1/health"):
            self._send(200, {"status": "ok", "service": "dooji-transform"})
            return
        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"status": "error", "error": "invalid JSON"})
            return

        # Development-only quota reset — 404 unless DOOJI_DEV_TOOLS=1.
        if path in ("/v1/dev/reset-quota", "/dev/reset-quota"):
            if not dev_tools_enabled():
                self._send(404, {"error": "not_found"})
                return
            try:
                body = handle_dev_reset_quota(
                    payload if isinstance(payload, dict) else {}
                )
                self._send(200, body)
            except Exception as exc:  # noqa: BLE001
                self._send(500, {"ok": False, "error": f"{type(exc).__name__}"})
            return

        if path != "/v1/transform":
            self._send(404, {"error": "not_found"})
            return
        try:
            client_id = self.headers.get("X-Dooji-Client-Id") or payload.get(
                "anonymous_client_id"
            )
            client_ip = self.client_address[0] if self.client_address else None
            body = handle_transform(
                payload, client_id=client_id, client_ip=client_ip
            )
            status = body.get("status")
            if status in ("ok", "dry_run"):
                code = 200
            elif status == "rate_limited":
                code = 429
            else:
                code = 502
            self._send(code, body)
        except ValueError as exc:
            self._send(400, {"status": "error", "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"status": "error", "error": f"{type(exc).__name__}"})


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    """Serve the transform stub.

    Default bind is 0.0.0.0 so a physical phone on the same LAN can reach
    POST /v1/transform. Override with DOOJI_HOST=127.0.0.1 for localhost-only.
    """
    httpd = ThreadingHTTPServer((host, port), TransformHandler)
    tools = "ON" if dev_tools_enabled() else "off"
    print(
        f"Dooji transform listening on http://{host}:{port}  "
        f"(POST /v1/transform; DOOJI_DEV_TOOLS={tools})"
    )
    if dev_tools_enabled():
        print("  DEV: POST /v1/dev/reset-quota  (local quota reset)")
    httpd.serve_forever()


if __name__ == "__main__":
    import os

    serve(
        host=os.environ.get("DOOJI_HOST", "0.0.0.0"),
        port=int(os.environ.get("DOOJI_PORT", "8080")),
    )
