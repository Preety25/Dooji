# Dooji production backend on Render

Operational reference for the hosted transform API: current production state,
required env, and how to redeploy. No FastAPI/ASGI migration. No object storage.

## Current production state

| Item | Status |
|------|--------|
| Web Service | **`dooji-api`** — live on Render |
| Public API origin | `https://dooji-api.onrender.com` |
| Provider | **xAI** / `grok-imagine-image-2.0` (`IMAGE_PROVIDER=xai`) |
| Generation policy | **Postgres** (`DOOJI_POLICY=postgres` + `DATABASE_URL`) |
| Health | `/health` and `/v1/health` verified healthy (includes Postgres readiness; does not call xAI) |
| Mobile | Production configuration points `EXPO_PUBLIC_TRANSFORM_MODE=http` at this hosted origin |

Baseline tag: `v0.1.0` on `product/mvp`.

## Services

1. **Web Service** (`dooji-api`) — runs `python -m product.api.app`
2. **Postgres** (`dooji-quota`) — generation policy / audit only

Optional: apply `render.yaml` as a Blueprint, then fill secrets in the dashboard.

## Start command

```bash
python -m product.api.app
```

Binds `0.0.0.0` and uses platform `PORT` (or `DOOJI_PORT` for local).

## Health check

- Path: `/health` (also `/v1/health`)
- Production readiness pings Postgres (does **not** call xAI)
- Unhealthy DB → HTTP 503 `{ "status": "unhealthy", "database": "unavailable" }`

## Required environment (production)

| Variable | Value |
|----------|--------|
| `DOOJI_ENV` | `production` |
| `IMAGE_PROVIDER` | `xai` |
| `XAI_API_KEY` | Render secret |
| `DOOJI_POLICY` | `postgres` |
| `DATABASE_URL` | Render Postgres connection string |
| `DOOJI_DEV_TOOLS` | unset / `0` |
| `DOOJI_ANON_GENERATION_LIMIT` | `6` |
| `DOOJI_GLOBAL_DAILY_BUDGET` | intentional daily cap (e.g. `500`) |
| `DOOJI_GENERATIONS_DISABLED` | `0` (set `1` for kill switch) |

Never put `DATABASE_URL` or `XAI_API_KEY` in mobile / `EXPO_PUBLIC_*`.

Production **fails closed**: mock provider, memory/file policy, missing key/URL,
or unreachable Postgres prevent serving generations.

## Policy backends

| Mode | `DOOJI_POLICY` | Use |
|------|----------------|-----|
| Dev (default) | `file` | local durable JSON |
| Tests | `memory` | process memory |
| Production | `postgres` | shared Postgres |

Schema tables (auto-created on startup / `python -m scripts.init_policy_schema`):

- `generation_attempts` — quota-consuming provider attempts (TIMESTAMPTZ UTC)
- `generation_audit` — audit events (no images / prompts / secrets)

## Image storage (intentional MVP)

xAI → base64 in API response → mobile local Library.  
The backend keeps images only in ephemeral request/response memory. **No object storage.**

## Local vs production

```bash
# Local mock (no Postgres, no xAI credits)
IMAGE_PROVIDER=mock DOOJI_POLICY=memory python -m product.api.app

# Production-shaped (requires DATABASE_URL + XAI_API_KEY)
DOOJI_ENV=production IMAGE_PROVIDER=xai DOOJI_POLICY=postgres \
  DATABASE_URL=... XAI_API_KEY=... python -m product.api.app
```

## Redeploy / ops checklist

Use when changing code on `product/mvp`, rotating secrets, or recovering from an unhealthy deploy. Initial create + first deploy are already done.

1. Confirm Web Service `dooji-api` tracks the intended branch (`product/mvp` / release tag).
2. Confirm Postgres `dooji-quota` remains linked via `DATABASE_URL`.
3. Confirm `XAI_API_KEY` is set as a Render secret (never in mobile / git).
4. Confirm env matches the production table above (`DOOJI_ENV=production`, `IMAGE_PROVIDER=xai`, `DOOJI_POLICY=postgres`, kill switch / budget as intended).
5. Deploy / clear build cache if needed; wait for service healthy.
6. Verify `GET https://dooji-api.onrender.com/health` and `/v1/health` → healthy JSON (Postgres up).
7. Smoke a mobile or HTTP transform against the hosted origin only when intentionally spending credits.
