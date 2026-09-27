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
) -> dict[str, Any]:
    """Core handler used by HTTP stub and unit tests."""
    req = parse_transform_body(payload)
    provider = get_provider(provider_name) if provider_name else get_provider(
        "mock" if req.options.dry_run else None
    )
    if req.options.dry_run:
        provider = get_provider("mock")
    result = TransformService(provider=provider).transform(req)
    # Mobile-facing: never include compiled prompt
    body = result.to_dict(include_image_base64=True)
    return body


class TransformHandler(BaseHTTPRequestHandler):
    server_version = "DoojiTransform/0.1"

    def log_message(self, fmt: str, *args) -> None:  # quieter default
        # Never log Authorization or bodies that might contain keys
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
        if path != "/v1/transform":
            self._send(404, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send(400, {"status": "error", "error": "invalid JSON"})
            return
        try:
            body = handle_transform(payload)
            code = 200 if body.get("status") in ("ok", "dry_run") else 502
            self._send(code, body)
        except ValueError as exc:
            self._send(400, {"status": "error", "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"status": "error", "error": f"{type(exc).__name__}"})


def serve(host: str = "127.0.0.1", port: int = 8080) -> None:
    httpd = ThreadingHTTPServer((host, port), TransformHandler)
    print(f"Dooji transform listening on http://{host}:{port}  (POST /v1/transform)")
    httpd.serve_forever()


if __name__ == "__main__":
    import os

    serve(
        host=os.environ.get("DOOJI_HOST", "127.0.0.1"),
        port=int(os.environ.get("DOOJI_PORT", "8080")),
    )
