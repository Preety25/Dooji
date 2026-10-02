"""xAI Imagine image-edit adapter for V4.

Uses POST https://api.x.ai/v1/images/edits with application/json (NOT multipart).
Does not use the OpenAI SDK images.edit() method.

Key handling:
  - Read ONLY from env XAI_API_KEY.
  - Never print, log, commit, or write the key (or any substring) anywhere.
  - Presence checks only: bool(os.environ.get("XAI_API_KEY")).
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

MODEL = "grok-imagine-image-2.0"
XAI_EDITS_URL = "https://api.x.ai/v1/images/edits"
DEFAULT_RESOLUTION = "1k"
DEFAULT_QUALITY = "low"
DEFAULT_N = 1
DEFAULT_RESPONSE_FORMAT = "b64_json"

# Approximate public list pricing for grok-imagine-image-2.0 (as of mid-2026).
# 1K + low output ~$0.04; each input image ~$0.01. Figures are estimates —
# confirm on https://docs.x.ai / console before budgeting.
_COST_OUTPUT_1K_LOW_USD = 0.04
_COST_INPUT_IMAGE_USD = 0.01


def has_xai_key() -> bool:
    return bool(os.environ.get("XAI_API_KEY"))


def approx_cost_usd(*, n_input_images: int = 2, resolution: str = "1k", quality: str = "low") -> dict:
    """Return an approximate cost estimate with uncertainty notes (no billing invention)."""
    notes = [
        "Estimate from public mid-2026 list rates for grok-imagine-image-2.0; not an invoice.",
        "Prior Imagine v1 was ~$0.02/image; 2.0 list starts ~$0.04 for 1K low output.",
        "Edits may also bill ~$0.01 per input image on the direct API.",
        "quality=low + resolution=1k used here; medium/2k cost more.",
    ]
    if resolution == "1k" and quality == "low":
        output = _COST_OUTPUT_1K_LOW_USD
    else:
        output = _COST_OUTPUT_1K_LOW_USD
        notes.append(f"resolution={resolution!r} quality={quality!r}: using 1K-low base as lower bound.")
    inputs = max(0, int(n_input_images)) * _COST_INPUT_IMAGE_USD
    total = round(output + inputs, 4)
    return {
        "approx_cost_usd": total,
        "breakdown": {
            "output_1k_low_usd": output,
            "input_images": int(n_input_images),
            "input_images_usd": inputs,
        },
        "uncertainty": notes,
    }


def _mime_for(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    if guessed and guessed.startswith("image/"):
        return guessed
    return "image/png"


def file_to_data_uri(path: Path) -> str:
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{_mime_for(path)};base64,{b64}"


def _image_obj(data_uri: str) -> dict:
    return {"url": data_uri, "type": "image_url"}


def _redact_headers(headers: dict) -> dict:
    out = {}
    for k, v in headers.items():
        if k.lower() == "authorization":
            out[k] = "Bearer [REDACTED]"
        else:
            out[k] = v
    return out


def _safe_error_body(raw: str, limit: int = 400) -> str:
    """Truncate error bodies; never echo Authorization or long prompts."""
    import re

    text = (raw or "").replace("\n", " ").strip()
    # Drop any accidental bearer / api-key echoes without capturing the secret.
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer [REDACTED]", text)
    text = re.sub(r"(?i)(api[_-]?key\s*[:=]\s*)\S+", r"\1[REDACTED]", text)
    if len(text) > limit:
        return text[:limit] + "…"
    return text


def _post_json(payload: dict, api_key: str, timeout_s: float = 180.0) -> tuple[int, dict | None, str, float]:
    """POST JSON to edits endpoint. Returns (status, parsed_json_or_None, raw_text, latency_ms)."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        XAI_EDITS_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        },
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            latency = (time.time() - t0) * 1000.0
            status = getattr(resp, "status", 200) or 200
            try:
                return status, json.loads(raw), raw, latency
            except json.JSONDecodeError:
                return status, None, raw, latency
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        latency = (time.time() - t0) * 1000.0
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = None
        return int(exc.code), parsed, raw, latency
    except Exception as exc:  # network / timeout
        latency = (time.time() - t0) * 1000.0
        return 0, None, f"{type(exc).__name__}: {exc}", latency


def _extract_image_bytes(
    parsed: dict, *, download_timeout_s: float = 120.0
) -> tuple[bytes | None, dict]:
    """Pull image bytes from b64_json or download URL. Returns (bytes, meta)."""
    meta: dict[str, Any] = {}
    data = parsed.get("data") if isinstance(parsed, dict) else None
    if not isinstance(data, list) or not data:
        # some SDK shapes nest differently
        if isinstance(parsed.get("url"), str):
            data = [parsed]
        else:
            return None, {"extract_error": "no data[] in response"}
    first = data[0] if data else {}
    if not isinstance(first, dict):
        return None, {"extract_error": "data[0] not an object"}

    for k in ("model", "revised_prompt"):
        if k in first:
            meta[k] = first[k]
    if "respect_moderation" in first:
        meta["respect_moderation"] = first["respect_moderation"]
    if "respect_moderation" in parsed:
        meta["respect_moderation"] = parsed["respect_moderation"]
    if parsed.get("model"):
        meta["model_returned"] = parsed["model"]

    b64 = first.get("b64_json") or first.get("b64")
    if b64:
        try:
            return base64.b64decode(b64), {**meta, "response_format_used": "b64_json"}
        except Exception as exc:
            return None, {**meta, "extract_error": f"b64 decode failed: {type(exc).__name__}"}

    url = first.get("url")
    if url and isinstance(url, str) and url.startswith("http"):
        try:
            with urllib.request.urlopen(url, timeout=download_timeout_s) as resp:
                return resp.read(), {**meta, "response_format_used": "url_download"}
        except Exception as exc:
            return None, {**meta, "extract_error": f"url download failed: {type(exc).__name__}"}

    return None, {**meta, "extract_error": "neither b64_json nor url present"}


def _base_payload(prompt: str, *, resolution: str, quality: str, n: int, response_format: str) -> dict:
    return {
        "model": MODEL,
        "prompt": prompt,
        "n": n,
        "resolution": resolution,
        "quality": quality,
        "response_format": response_format,
    }


def edit_image(
    *,
    doodle_path: Path,
    prompt: str,
    out_png: Path,
    style_ref_path: Path | None = None,
    style_ref_paths: list | None = None,
    resolution: str = DEFAULT_RESOLUTION,
    quality: str = DEFAULT_QUALITY,
    n: int = DEFAULT_N,
    response_format: str = DEFAULT_RESPONSE_FORMAT,
    prefer_multi_image: bool = True,
    allow_single_fallback: bool = True,
    http_timeout_s: float = 180.0,
    download_timeout_s: float = 120.0,
) -> dict:
    """Call xAI image edits. Prefer multi-image (doodle + style ref(s)); fall back on 400/422.

    style_ref_paths: optional list of style reference images (preferred when set).
    style_ref_path: single style ref (backward compatible). If both given, style_ref_paths wins.

    Returns a metadata dict. Never includes the API key.
    """
    if not has_xai_key():
        return {
            "ok": False,
            "error": "XAI_API_KEY unset",
            "model": MODEL,
        }
    # Read key into a local only; never put it in returned meta or logs.
    api_key = os.environ.get("XAI_API_KEY") or ""

    doodle_path = Path(doodle_path)
    out_png = Path(out_png)
    if not doodle_path.is_file():
        return {"ok": False, "error": f"doodle missing: {doodle_path}", "model": MODEL}

    doodle_uri = file_to_data_uri(doodle_path)

    # Normalize style refs to a list of Paths
    style_paths: list[Path] = []
    if style_ref_paths:
        style_paths = [Path(p) for p in style_ref_paths]
    elif style_ref_path is not None:
        style_paths = [Path(style_ref_path)]
    for sp in style_paths:
        if not sp.is_file():
            return {"ok": False, "error": f"style ref missing: {sp}", "model": MODEL}
    style_uris = [file_to_data_uri(sp) for sp in style_paths]
    style_uri = style_uris[0] if style_uris else None
    # Keep first path in style_ref_path for backward-compatible success meta
    if style_paths:
        style_ref_path = style_paths[0]
    n_inputs = 1 + len(style_uris)

    attempts: list[dict] = []
    cost = approx_cost_usd(
        n_input_images=n_inputs if (prefer_multi_image and style_uris) else 1,
        resolution=resolution,
        quality=quality,
    )

    def _try(label: str, image_field: Any, n_in: int) -> dict:
        payload = _base_payload(
            prompt, resolution=resolution, quality=quality, n=n, response_format=response_format
        )
        payload["image"] = image_field
        status, parsed, raw, latency_ms = _post_json(
            payload, api_key, timeout_s=http_timeout_s
        )
        attempt = {
            "label": label,
            "http_status": status,
            "latency_ms": int(latency_ms),
            "n_input_images": n_in,
            "request_shape": "image:list" if isinstance(image_field, list) else "image:object",
        }
        if status == 200 and isinstance(parsed, dict):
            img_bytes, extract_meta = _extract_image_bytes(
                parsed, download_timeout_s=download_timeout_s
            )
            attempt["extract"] = {k: v for k, v in extract_meta.items() if k != "revised_prompt"}
            # revised_prompt can be huge / echo user content; keep length only
            if "revised_prompt" in extract_meta:
                attempt["revised_prompt_len"] = len(str(extract_meta["revised_prompt"]))
            if img_bytes:
                out_png.parent.mkdir(parents=True, exist_ok=True)
                out_png.write_bytes(img_bytes)
                attempt["ok"] = True
                attempt["bytes"] = len(img_bytes)
            else:
                attempt["ok"] = False
                attempt["error"] = extract_meta.get("extract_error", "no image bytes")
        else:
            attempt["ok"] = False
            attempt["error"] = _safe_error_body(raw if not isinstance(parsed, dict) else json.dumps(
                {k: parsed[k] for k in parsed if k != "data"} if parsed else {}
            ))
            if isinstance(parsed, dict) and "error" in parsed:
                err = parsed["error"]
                if isinstance(err, dict):
                    attempt["error"] = _safe_error_body(str(err.get("message") or err))
                else:
                    attempt["error"] = _safe_error_body(str(err))
        attempts.append(attempt)
        return attempt

    # 1) Multi-image: prefer working `images` array shape first (prior smoke:
    # `image` as list-of-maps → 422; `images` array succeeded).
    # When multiple style refs are provided, try doodle+all first; on recoverable
    # 422 (e.g. max 2 images), retry doodle+first style ref only.
    if prefer_multi_image and style_uris:
        image_plans: list[tuple[str, list]] = [
            (
                f"multi_images_array_n{1 + len(style_uris)}",
                [_image_obj(doodle_uri), *[_image_obj(u) for u in style_uris]],
            )
        ]
        if len(style_uris) > 1:
            image_plans.append(
                (
                    "multi_images_array_n2_fallback",
                    [_image_obj(doodle_uri), _image_obj(style_uris[0])],
                )
            )

        for label, img_list in image_plans:
            payload_images = _base_payload(
                prompt, resolution=resolution, quality=quality, n=n, response_format=response_format
            )
            payload_images["images"] = img_list
            status, parsed, raw, latency_ms = _post_json(
                payload_images, api_key, timeout_s=http_timeout_s
            )
            attempt = {
                "label": label,
                "http_status": status,
                "latency_ms": int(latency_ms),
                "n_input_images": len(img_list),
                "request_shape": "images:list",
                "style_ref_count": len(img_list) - 1,
            }
            if status == 200 and isinstance(parsed, dict):
                img_bytes, extract_meta = _extract_image_bytes(
                    parsed, download_timeout_s=download_timeout_s
                )
                attempt["extract"] = {k: v for k, v in extract_meta.items() if k != "revised_prompt"}
                if "revised_prompt" in extract_meta:
                    attempt["revised_prompt_len"] = len(str(extract_meta["revised_prompt"]))
                if img_bytes:
                    out_png.parent.mkdir(parents=True, exist_ok=True)
                    out_png.write_bytes(img_bytes)
                    attempt["ok"] = True
                    attempt["bytes"] = len(img_bytes)
                    attempts.append(attempt)
                    cost_n = approx_cost_usd(
                        n_input_images=len(img_list), resolution=resolution, quality=quality
                    )
                    return _success(
                        out_png, attempt, attempts, cost_n, doodle_path, style_ref_path,
                        resolution, quality, n, prompt,
                        style_refs_used=[str(p) for p in style_paths[: len(img_list) - 1]],
                    )
                attempt["ok"] = False
                attempt["error"] = extract_meta.get("extract_error", "no image bytes")
            else:
                attempt["ok"] = False
                attempt["error"] = _safe_error_body(
                    raw if not isinstance(parsed, dict) else json.dumps(
                        {k: parsed[k] for k in parsed if k != "data"} if parsed else {}
                    )
                )
                if isinstance(parsed, dict) and "error" in parsed:
                    err = parsed["error"]
                    if isinstance(err, dict):
                        attempt["error"] = _safe_error_body(str(err.get("message") or err))
                    else:
                        attempt["error"] = _safe_error_body(str(err))
            attempts.append(attempt)
            # Only continue to fewer-image plan on recoverable shape / validation errors
            if status not in (400, 422):
                break

        # Recoverable shape retry: some drafts accept `image` as a list of maps.
        # Known-failing on current API (422) — only try if `images` failed.
        result = _try(
            "multi_image_list",
            [_image_obj(doodle_uri), _image_obj(style_uri)],
            2,
        )
        if result.get("ok"):
            return _success(
                out_png, result, attempts, cost, doodle_path, style_ref_path,
                resolution, quality, n, prompt,
                style_refs_used=[str(style_paths[0])],
            )

    # 2) Fall back: single-image (doodle only). Caller should use a prompt that
    # describes style in text when multi-image is unavailable.
    cost1 = approx_cost_usd(n_input_images=1, resolution=resolution, quality=quality)
    if allow_single_fallback:
        result = _try("single_image", _image_obj(doodle_uri), 1)
        if result.get("ok"):
            return _success(out_png, result, attempts, cost1, doodle_path, style_ref_path,
                            resolution, quality, n, prompt, fallback_single=True)
    else:
        cost1 = approx_cost_usd(
            n_input_images=(1 + len(style_uris)) if (prefer_multi_image and style_uris) else 1,
            resolution=resolution,
            quality=quality,
        )

    return {
        "ok": False,
        "error": attempts[-1].get("error") if attempts else "edit failed",
        "model": MODEL,
        "resolution": resolution,
        "quality": quality,
        "n": n,
        "attempts": attempts,
        "approx_cost_usd": None,
        "cost_estimate": cost1 if attempts else cost,
        "input_doodle": str(doodle_path),
        "input_style_ref": str(style_ref_path) if style_ref_path else None,
        "prompt_len": len(prompt),
        "headers_sent": _redact_headers(
            {"Content-Type": "application/json", "Authorization": "Bearer x", "Accept": "application/json"}
        ),
    }


def _success(
    out_png: Path,
    result: dict,
    attempts: list,
    cost: dict,
    doodle_path: Path,
    style_ref_path: Path | None,
    resolution: str,
    quality: str,
    n: int,
    prompt: str,
    fallback_single: bool = False,
    style_refs_used: list | None = None,
) -> dict:
    extract = result.get("extract") or {}
    return {
        "ok": True,
        "model": MODEL,
        "model_returned": extract.get("model_returned") or extract.get("model") or MODEL,
        "resolution": resolution,
        "quality": quality,
        "n": n,
        "latency_ms": result.get("latency_ms"),
        "http_status": result.get("http_status", 200),
        "response_format_used": extract.get("response_format_used"),
        "respect_moderation": extract.get("respect_moderation"),
        "output_png": str(out_png),
        "output_bytes": result.get("bytes"),
        "input_doodle": str(doodle_path),
        "input_style_ref": str(style_ref_path) if style_ref_path else None,
        "input_style_refs": style_refs_used or (
            [str(style_ref_path)] if style_ref_path else []
        ),
        "fallback_single_image": fallback_single,
        "attempt_label": result.get("label"),
        "n_input_images": result.get("n_input_images") or cost.get("breakdown", {}).get("input_images"),
        "attempts": [
            {k: v for k, v in a.items() if k != "error" or not a.get("ok")}
            for a in attempts
        ],
        "approx_cost_usd": cost.get("approx_cost_usd"),
        "cost_estimate": cost,
        "prompt": prompt,
        "prompt_len": len(prompt),
    }
