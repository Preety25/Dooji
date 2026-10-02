# Dooji production backend on Render

Smallest path to host the existing `ThreadingHTTPServer` transform API with
durable Postgres quota state. No FastAPI/ASGI migration. No object storage.

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

## Manual Render steps still required

1. Create Web Service from this repo (`product/mvp`) or Blueprint.
2. Create Postgres and link `DATABASE_URL`.
3. Set `XAI_API_KEY` as a secret.
4. Confirm health check path `/health`.
5. Deploy when ready (not done by the coding agent in Phase 3A).
