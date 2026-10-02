"""Reset local/dev GenerationPolicy quota (does NOT touch Library data).

Requires the transform API to be running with DOOJI_DEV_TOOLS=1.

Usage (PowerShell), from repo root, with the API already up:

  Invoke-RestMethod -Method POST `
    -Uri "http://127.0.0.1:8080/v1/dev/reset-quota" `
    -ContentType "application/json" `
    -Body '{"all":true}'

Or via this helper:

  python -m scripts.reset_dev_quota
  python -m scripts.reset_dev_quota --client anon_xxx
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DEV-ONLY: reset local generation quota")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EXPO_PUBLIC_TRANSFORM_API_URL")
        or os.environ.get("DOOJI_TRANSFORM_URL")
        or "http://127.0.0.1:8080",
        help="Transform API base URL (default http://127.0.0.1:8080)",
    )
    parser.add_argument(
        "--client",
        default=None,
        help="Optional anonymous_client_id; omit to reset all local quota",
    )
    args = parser.parse_args(argv)
    base = args.base_url.rstrip("/")
    url = f"{base}/v1/dev/reset-quota"
    payload = {"all": True} if not args.client else {"anonymous_client_id": args.client}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            body = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}: {raw}", file=sys.stderr)
        if exc.code == 404:
            print(
                "Hint: restart the API with DOOJI_DEV_TOOLS=1, e.g.\n"
                '  $env:DOOJI_DEV_TOOLS="1"; python -m product.api.app',
                file=sys.stderr,
            )
        return 1
    except urllib.error.URLError as exc:
        print(f"Could not reach {url}: {exc}", file=sys.stderr)
        print(
            "Start the API first with DOOJI_DEV_TOOLS=1, then retry.",
            file=sys.stderr,
        )
        return 1

    print(json.dumps(body, indent=2))
    return 0 if body.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
