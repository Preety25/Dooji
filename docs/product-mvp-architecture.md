# Product MVP Architecture — Dooji

**Branch:** `product/mvp`  
**Baseline:** tag **`v0.1.0`** → commit `6e1ed7ea1ce40683b00a03631f8db0ca052e6222`  
**Scope:** Shipped MVP product path — Expo mobile app + hosted transform API + Postgres generation policy + xAI provider.

This document describes **current production architecture**. Historical lab/POC material is labeled explicitly at the end and is not the product path.

Launch planning (not architecture): [`docs/launch/LAUNCH-READINESS.md`](launch/LAUNCH-READINESS.md).  
Transformation doctrine: [`docs/spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md`](spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md).

---

## 1. What is shipped today

| Layer | Status |
|---|---|
| Mobile app (`mobile/`) | Expo / React Native / TypeScript — canvas, generate, result, library, local cache |
| Transform API (`product/api`) | Hosted on Render as `dooji-api` (`https://dooji-api.onrender.com`) |
| Provider | **xAI** / `grok-imagine-image-2.0` via `XAIImageProvider` |
| Styles | Gummy, Clay, Plush, Glossy (`product/styles/*.json`) |
| Generation policy | Postgres (`DOOJI_POLICY=postgres`) — anon limits, global budget, kill switch |
| Postprocess | Border-connected flood alpha / sticker finish (not a no-op stub) |
| Secrets | Server-only (`XAI_API_KEY`, `DATABASE_URL`); never in mobile |
| Auth / accounts | **Not shipped** — anonymous client id for quota only |
| Analytics | Local typed event log placeholder (no third-party SDK) |
| Payments | **Not shipped** |
| App Store / Play builds | **Not shipped** — verified via Expo Go / device E2E against hosted API |

---

## 2. Runtime path

```text
Expo app (mobile/)
   │  TransformRequest / TransformResult only
   ▼
mobile/src/transform getTransformClient()
   ├─ MockTransformClient (local default — bundled samples)
   └─ HttpTransformClient → POST /v1/transform
         ▼
product/api (Render / local)
   ├─ request limits + optional dry_run (dev only)
   ├─ generation policy (memory | file | postgres)
   ▼
TransformService
   ├─ ingest doodle (PNG / optional strokes raster)
   ├─ style pack + prompt compiler (v1.2 doctrine)
   ├─ ImageProvider (mock | xai)
   └─ postprocess → final PNG
         ▼
base64 (or url) → mobile ensureStyleAsset / Library (AsyncStorage + files)
```

App must **not** embed prompts, style sheets, or provider SDKs/keys.  
See `mobile/README.md` for env knobs (`EXPO_PUBLIC_TRANSFORM_MODE`, `EXPO_PUBLIC_TRANSFORM_API_URL`).

---

## 3. Production package (`product/`)

| Module | Role |
|---|---|
| `product/providers/xai.py` | Live xAI Imagine edits (`grok-imagine-image-2.0`) behind `ImageProvider` |
| `product/providers/mock.py` | CI / local zero-credit provider |
| `product/transform/prompt_compiler.py` | v1.2 doctrine + style fragments; no lab `SPECIAL(uid)` hardcodes |
| `product/styles/*.json` | gummy / clay / plush / glossy as data |
| `product/transform/raster.py` | Optional stroke JSON → PNG when client sends strokes |
| `product/transform/postprocess.py` | Border flood bg removal → alpha → crop/normalize |
| `product/transform/service.py` | Orchestration: ingest → prompt → provider → postprocess |
| `product/policy/` | Generation quota / audit (`memory` / `file` / `postgres`) |
| `product/api/app.py` | `POST /v1/transform`, `GET /health` (stdlib HTTP) |

**Not on the production path:** Blender lab jobs, experiment runners, hand `ENRICHMENTS`, research scripts under `lab/`, benchmark scratch under untracked `product/benchmark/` (research only), `out/` artifacts.

---

## 4. API boundary

```http
POST /v1/transform
Content-Type: application/json

{
  "style": "gummy" | "clay" | "plush" | "glossy",
  "doodle_base64": "<png bytes>",
  "strokes": { ... } | null,
  "doodle_path": null,
  "client_doodle_id": "optional",
  "anonymous_client_id": "optional-quota-identity",
  "options": { "size": 1024, "dry_run": false }
}
```

**Response (shape):**

```json
{
  "status": "ok" | "dry_run" | "error",
  "style": "gummy",
  "transform_version": "product.mvp.v1",
  "provider": "xai" | "mock",
  "model": "grok-imagine-image-2.0",
  "image_path": null,
  "image_url": null,
  "image_base64": "<final png>",
  "error": null,
  "metadata": {
    "prompt_len": 1234,
    "style_sheet": "...",
    "style_version": "1.0.0",
    "postprocess": { "steps": [] },
    "provider": { }
  }
}
```

**Contract rules:**

- Client does not choose provider implementation details.
- Full prompts, style sheets, and API keys never appear in the response body.
- `GET /health` / `GET /v1/health` for liveness (production also checks Postgres).

Core types: `TransformRequest` / `TransformResult` in `product/transform/contracts.py`.  
Handler: `product.api.app.handle_transform`.

---

## 5. Provider abstraction

```text
ImageProvider.generate(ProviderGenerateRequest) → ProviderGenerateResult
```

- **`XAIImageProvider`** — production live backend
- **`MockImageProvider`** — CI / local, zero credits
- Factory: `product.providers.get_provider()` via `IMAGE_PROVIDER=xai|mock`
- Production (`DOOJI_ENV=production`) requires `xai` + `XAI_API_KEY` (mock rejected)
- Future Gemini/OpenAI adapters = new class + env; **TransformRequest / mobile contract unchanged**

---

## 6. Style abstraction

Styles live as JSON under `product/styles/`:

- `sheet` + `sheet_fallbacks`
- `description`, `form_language`, `material_language`, `lighting_language`
- `forbidden[]`
- `prompt_fragments`

Material reference boards are tracked under `docs/refs/style_sheets/` (and product asset paths referenced from style JSON). Mobile cache identity pins style versions in `mobile/src/generation/versions.ts` (must stay aligned with `product/styles/*.json`).

---

## 7. Generation policy & hosting

| Concern | Production |
|---|---|
| Host | Render Web Service `dooji-api` |
| DB | Render Postgres `dooji-quota` |
| Policy | `DOOJI_POLICY=postgres` |
| Anon limit | `DOOJI_ANON_GENERATION_LIMIT` (default 6 / rolling window) |
| Global budget | `DOOJI_GLOBAL_DAILY_BUDGET` |
| Kill switch | `DOOJI_GENERATIONS_DISABLED=1` rejects new provider generations |
| Image storage | Ephemeral request/response only — no object storage; Library is on-device |

Blueprint (no secrets): `render.yaml`. Ops notes: [`docs/deploy/RENDER.md`](deploy/RENDER.md).

Local defaults typically use `IMAGE_PROVIDER=mock` and `DOOJI_POLICY=memory|file`.

---

## 8. Secrets & configuration

| Variable | Where | Notes |
|---|---|---|
| `XAI_API_KEY` | Server only | Required for live xAI |
| `IMAGE_PROVIDER` | Server | `xai` \| `mock` |
| `DATABASE_URL` | Server only | Required when `DOOJI_POLICY=postgres` |
| `DOOJI_POLICY` | Server | `memory` \| `file` \| `postgres` |
| `DOOJI_ENV` | Server | `production` fails closed |
| `DOOJI_OUT` | Server optional | Persist finals under this dir |
| `DOOJI_HOST` / `DOOJI_PORT` / `PORT` | Server | Bind; Render injects `PORT` |
| `EXPO_PUBLIC_TRANSFORM_MODE` | Mobile | `mock` \| `http` |
| `EXPO_PUBLIC_TRANSFORM_API_URL` | Mobile | HTTPS origin in production builds |

See `.env.example` (placeholders only). `.env` is gitignored.

---

## 9. Post-processing

Pipeline in `product/transform/postprocess.py`:

```text
generated → border-connected flood bg removal → alpha/edge (RGBA) → crop/normalize → final PNG
```

Pillow recommended (`requirements-product.txt`). Corner flood removes opaque provider backdrops while preserving interior light regions. Further matting polish remains a quality follow-up, not a missing seam.

---

## 10. Mobile generation cache

- Canonical source: doodle fingerprint (strokes / source identity).
- Per-style assets keyed by transform + style + semantic version pins.
- Cache identity uses **mobile** `STYLE_VERSIONS` pins (aligned with server style pack versions) so Library / Result hydration stays consistent across styles (including Plush `1.1.0`).
- Re-selecting a generated style should hit cache when source + versions match.

---

## 11. Switching providers

1. Implement `ImageProvider` (same `generate` signature).
2. Register in `product.providers.get_provider`.
3. Set `IMAGE_PROVIDER=…` + provider-specific secrets.
4. Keep prompt compiler + style packs + mobile contract unchanged.
5. Gate with mock smoke + a small live golden subset when credits allow.

---

## 12. How to run smoke tests

```bash
# CI-safe (default — mock provider, no credits)
python3 -m tests.product.test_transform_smoke

# Optional live (spends xAI credits — not for CI)
IMAGE_PROVIDER=xai DOOJI_LIVE=1 XAI_API_KEY=... python3 -m tests.product.test_transform_smoke

# Mobile generation / flow tests
cd mobile && npm run test:generation && npm run typecheck

# Optional local API
IMAGE_PROVIDER=mock DOOJI_POLICY=memory python3 -m product.api.app
```

---

## 13. Remaining product work (launch-oriented)

Hosted API, mobile HTTP connectivity, Postgres quota, and the Expo MVP shell are **done** for the `v0.1.0` baseline.

Still outside that baseline (see [`LAUNCH-READINESS.md`](launch/LAUNCH-READINESS.md)):

1. Production iOS / Android store builds and distribution testing.
2. Broader multi-device reliability (latency ~1 minute is a known limitation).
3. Privacy policy / data disclosures; stronger analytics if needed for beta.
4. Account auth, payments, and durable cloud image storage (intentionally out of MVP).
5. Semantic recognition / reconstruction quality iteration beyond current compiler defaults.
6. Provider evaluation and additional styles.

---

## Appendix A — Historical lab / POC (not product path)

The stylization lab under `lab/v4/` (and earlier `lab/v3/`, Blender-era docs) is an **experiment tree**. It informed the product extraction but is not what ships to users.

| Area | Role |
|---|---|
| `lab/v4/generative/xai_edit.py` | Early xAI Imagine client reused behind `product/providers/xai.py` |
| `lab/v4/generative/prompts.py` | Prompt builders through V4.4 (lab) |
| `lab/v4/stroke_roles.py` | Role taxonomy helpers still referenced carefully from product |
| `lab/v4/strict_blueprint.py` / `semantic_lock.py` | Research recognition / enrichments |
| `lab/v4/v4*_*.py` + runners | Experiment runners, contact sheets, spend caps |
| `out/v4/**` | Run artifacts / reviews |
| Top-level Blender README-era docs | Early “stylization lab POC” packaging — superseded for product entry by root `README.md` |
| `docs/spec-v1.1/` | Superseded Recognition-Assisted Polish doctrine |

Lab code on this branch is **preserved**. Production does not delete or rewrite experiment runners as part of normal product work.

Early LAN device E2E evidence (laptop API + Expo Go) remains in [`docs/golden-path-device-e2e.md`](golden-path-device-e2e.md) as a historical known-good record; production verification now also includes the hosted Render API.
