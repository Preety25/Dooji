"""One-time / ops helper: create generation-policy tables.

Schema is also ensured automatically when PostgresGenerationPolicy starts.
Use this when you want to prepare a fresh Render database before traffic.

Usage:
  DATABASE_URL=postgres://... python -m scripts.init_policy_schema

Never logs the connection string.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from product.policy.postgres_policy import PostgresGenerationPolicy, resolve_database_url


def main() -> int:
    if not resolve_database_url():
        print("DATABASE_URL (or DOOJI_DATABASE_URL) is required", file=sys.stderr)
        return 1
    pol = PostgresGenerationPolicy(autocommit_schema=False)
    pol.ensure_schema()
    pol.ping()
    print("ok: generation_attempts + generation_audit ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
