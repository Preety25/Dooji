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
from product.runtime import (
    allow_doodle_path,
    allow_dry_run,
    generations_disabled,
    is_production,
    max_body_bytes,
    max_image_bytes,
    max_stroke_count,
    resolve_bind_host,
    resolve_bind_port,
)
from product.transform.contracts import TransformOptions, TransformRequest
from product.transform.service import TransformService


class PayloadTooLarge(ValueError):
    """Request exceeded configured size limits."""


def parse_transform_body(payload: dict[str, Any]) -> TransformRequest:
    """Map JSON body → TransformRequest.

    Live clients should send **both** raster + strokes:
      - doodle_base64 / doodle_png_base64  (primary identity PNG)
      - strokes                            (canonical stroke JSON)
      - style

    Accepted image fields (first wins for raster bytes):
      - doodle_base64 / doodle_png_base64
      - doodle_path (dev/ops only — never in production)
      - strokes alone (server raster fallback via lab.v3.raster)
    """
    opts_raw = payload.get("options") or {}
    dry_run = bool(opts_raw.get("dry_run") or False)
    if dry_run and not allow_dry_run():
        raise ValueError("dry_run is not allowed in production")

    size = int(opts_raw.get("size") or 1024)
    if size < 64 or size > 2048:
        raise ValueError("options.size out of range")

    options = TransformOptions(
        size=size,
        dry_run=dry_run,
        recognition=opts_raw.get("recognition"),
    )
    doodle_png = None
    b64 = payload.get("doodle_base64") or payload.get("doodle_png_base64")
    if b64:
        if isinstance(b64, str) and "," in b64 and b64.strip().startswith("data:"):
            b64 = b64.split(",", 1)[1]
        # Bound decoded size before allocate: base64 expands ~4/3.
        if isinstance(b64, str) and (len(b64) * 3) // 4 > max_image_bytes():
            raise PayloadTooLarge("doodle image exceeds size limit")
        doodle_png = base64.b64decode(b64)
        if len(doodle_png) > max_image_bytes():
            raise PayloadTooLarge("doodle image exceeds size limit")

    doodle_path = payload.get("doodle_path")
    if doodle_path:
        if not allow_doodle_path():
            raise ValueError("doodle_path is not allowed")
        if not isinstance(doodle_path, str) or ".." in doodle_path.replace("\\", "/"):
            raise ValueError("invalid doodle_path")

    strokes = payload.get("strokes")
    if strokes is not None:
        if isinstance(strokes, list):
            count = len(strokes)
        elif isinstance(strokes, dict):
            inner = strokes.get("strokes")
            count = len(inner) if isinstance(inner, list) else 0
        else:
            raise ValueError("strokes must be a list or stroke document")
        if count > max_stroke_count():
            raise PayloadTooLarge("stroke count exceeds limit")

    return TransformRequest(
        style=str(payload.get("style") or ""),
        doodle_png=doodle_png,
        doodle_path=doodle_path if allow_doodle_path() else None,
        strokes=strokes,
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

    Flow: parse → kill switch → GenerationPolicy → provider → response.
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

    # Emergency kill switch — before quota accounting / provider.
    if generations_disabled() and not req.options.dry_run:
        return {
            "status": "error",
            "style": req.style,
            "transform_version": "product.mvp.v1",
            "error": "generations_disabled",
            "metadata": {
                "reason": "generations_disabled",
                "message": "New generations are temporarily unavailable. Please try again later.",
            },
        }

    # dry_run skips quota — local/dev only (rejected in production above).
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

    if req.options.dry_run:
        provider = get_provider("mock")
    elif provider_name:
        provider = get_provider(provider_name)
    else:
        provider = get_provider(None)

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
        if length > max_body_bytes():
            self._send(
                413,
                {
                    "status": "error",
                    "error": "payload_too_large",
                    "metadata": {"max_body_bytes": max_body_bytes()},
                },
            )
            return
        raw = self.rfile.read(length) if length else b"{}"
        if len(raw) > max_body_bytes():
            self._send(
                413,
                {
                    "status": "error",
                    "error": "payload_too_large",
                    "metadata": {"max_body_bytes": max_body_bytes()},
                },
            )
            return
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"status": "error", "error": "invalid JSON"})
            return

        # Development-only quota reset — 404 unless DOOJI_DEV_TOOLS=1.
        if path in ("/v1/dev/reset-quota", "/dev/reset-quota"):
            if not dev_tools_enabled() or is_production():
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
            elif body.get("error") == "generations_disabled":
                code = 503
            else:
                code = 502
            self._send(code, body)
        except PayloadTooLarge as exc:
            self._send(
                413,
                {"status": "error", "error": "payload_too_large", "metadata": {"detail": str(exc)}},
            )
        except ValueError as exc:
            self._send(400, {"status": "error", "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"status": "error", "error": f"{type(exc).__name__}"})


def serve(host: str | None = None, port: int | None = None) -> None:
    """Serve the transform stub.

    Default bind is 0.0.0.0 so a physical phone on the same LAN can reach
    POST /v1/transform. Override with DOOJI_HOST=127.0.0.1 for localhost-only.
    Port: DOOJI_PORT, else platform PORT, else 8080.
    """
    host = host if host is not None else resolve_bind_host()
    port = port if port is not None else resolve_bind_port()
    httpd = ThreadingHTTPServer((host, port), TransformHandler)
    tools = "ON" if dev_tools_enabled() and not is_production() else "off"
    env = "production" if is_production() else "development"
    print(
        f"Dooji transform listening on http://{host}:{port}  "
        f"(POST /v1/transform; env={env}; DOOJI_DEV_TOOLS={tools})"
    )
    if tools == "ON":
        print("  DEV: POST /v1/dev/reset-quota  (local quota reset)")
    if generations_disabled():
        print("  KILL SWITCH: DOOJI_GENERATIONS_DISABLED is active")
    httpd.serve_forever()


if __name__ == "__main__":
    serve()
