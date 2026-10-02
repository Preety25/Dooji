# Dooji

Dooji turns a rough doodle into a shareable stylized sticker **without making it stop feeling like yours**.

**Core principle:** rough doodle → understand intent → reconstruct/polish → stylize.

> Draw something messy. Dooji understands what you meant, cleans it up, and makes it beautiful.

Transformation doctrine (canonical): [`docs/spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md`](docs/spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md) — **Intent-Preserving Stylized Reconstruction** (v1.2).

---

## MVP status (`v0.1.0`)

Frozen production baseline tag: **`v0.1.0`** → commit `6e1ed7ea1ce40683b00a03631f8db0ca052e6222` on branch `product/mvp`.

| Area | Status |
|------|--------|
| Mobile app | Expo / React Native / TypeScript MVP (canvas → generate → result → library) |
| Production API | Hosted on Render (`dooji-api`) at `https://dooji-api.onrender.com` |
| Provider | **xAI** / `grok-imagine-image-2.0` (server-side only) |
| Styles | **Gummy**, **Clay**, **Plush**, **Glossy** |
| Quota / policy | Postgres-backed anonymous generation limits + kill switch |
| Auth / payments | Not in MVP (anonymous client id for quota only) |
| Store builds | Not yet (Expo Go / dev builds for verification) |

**Known limitation:** a live generation often takes on the order of **~1 minute**.

Launch checklist (planning only): [`docs/launch/LAUNCH-READINESS.md`](docs/launch/LAUNCH-READINESS.md).

---

## Repository layout

| Path | Role |
|------|------|
| `mobile/` | **Product** — Expo app (UI, canvas, library, generation cache) |
| `product/` | **Product** — transform API, prompt compiler, styles, providers, policy, postprocess |
| `docs/spec-v1.2/` | **Product** — current transformation specification |
| `docs/product/` | **Product** — product contract |
| `docs/deploy/` | **Product** — Render hosting notes |
| `lab/` | **Historical / research** — V3/V4 experiment tree (not the product path) |
| `docs/spec-v1.1/` | **Historical** — superseded Recognition-Assisted Polish spec |
| `docs/visual_language.md`, `docs/Product_v2.md`, Blender/lab notes | **Historical** — early stylization-lab / art-direction research |
| `out/` | Local run artifacts (gitignored / not product source) |

Product code must not depend on experiment runners, hand enrichments, or Blender lab jobs. Lab code is preserved for research; it is not the shipped app.

Architecture overview: [`docs/product-mvp-architecture.md`](docs/product-mvp-architecture.md).

---

## Production transform (high level)

```
Mobile (Expo)
  → POST /v1/transform  (doodle PNG + strokes + style)
  → product/api (Render)
       → generation policy (Postgres quota / kill switch)
       → prompt compiler (v1.2 doctrine + style pack)
       → ImageProvider (xAI, or mock in local/CI)
       → postprocess (border flood alpha / sticker finish)
  → PNG (base64) → mobile cache + Library
```

- Prompts, style sheets, and provider keys stay **server-side**.
- Mobile talks only `TransformRequest` / `TransformResult`.
- Swapping providers later is an adapter + env change; the mobile contract stays stable.

---

## Styles

| ID | Look |
|----|------|
| `gummy` | Soft translucent candy / jelly volume |
| `clay` | Matte polymer / play-doh sculpt |
| `plush` | Short-pile stuffed-toy fuzz |
| `glossy` | Hard-candy / vinyl collectible sheen |

Style packs live under `product/styles/*.json`.

---

## Local development

### Backend (transform API)

```bash
# from repo root
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Zero-credit local API (recommended for day-to-day)
set IMAGE_PROVIDER=mock
set DOOJI_POLICY=memory
python -m product.api.app
# GET http://127.0.0.1:8080/health
```

Copy `.env.example` to a local `.env` (or set process env). **Never** put `XAI_API_KEY` or `DATABASE_URL` in mobile / `EXPO_PUBLIC_*` vars.

Live local xAI (spends credits; server only):

```bash
set IMAGE_PROVIDER=xai
set XAI_API_KEY=...   # process env only — do not commit
python -m product.api.app
```

Deploy / production env notes: [`docs/deploy/RENDER.md`](docs/deploy/RENDER.md). Blueprint shape (no secrets): `render.yaml`.

### Mobile

```bash
cd mobile
npm install
npm start
```

| Env | Purpose |
|-----|---------|
| `EXPO_PUBLIC_TRANSFORM_MODE=mock` | Default — bundled sample stickers, no network transform |
| `EXPO_PUBLIC_TRANSFORM_MODE=http` | Call a transform API |
| `EXPO_PUBLIC_TRANSFORM_API_URL` | API origin (local LAN, or `https://dooji-api.onrender.com` for hosted) |

Physical-device LAN notes (historical known-good record): [`docs/golden-path-device-e2e.md`](docs/golden-path-device-e2e.md).

More mobile detail: [`mobile/README.md`](mobile/README.md).

---

## Mock mode (no AI credits)

Use mock end-to-end when you do not want to spend provider credits:

1. **API:** `IMAGE_PROVIDER=mock` (and typically `DOOJI_POLICY=memory` locally).
2. **Mobile:** `EXPO_PUBLIC_TRANSFORM_MODE=mock` for fully offline samples, **or** `http` pointed at a mock API to exercise the real HTTP client + server path without xAI.
3. **CI / smoke:** default product smoke tests use the mock provider.

Do **not** set `DOOJI_LIVE=1` or `IMAGE_PROVIDER=xai` unless you intentionally want a paid generation.

---

## Tests

### Product transform (Python, zero credits by default)

```bash
# repo root
python -m tests.product.test_transform_smoke
```

Optional live smoke (spends credits — not for routine CI):

```bash
set IMAGE_PROVIDER=xai
set DOOJI_LIVE=1
set XAI_API_KEY=...
python -m tests.product.test_transform_smoke
```

### Mobile generation / flow (TypeScript)

```bash
cd mobile
npm run typecheck
npm run test:generation
```

---

## Documentation map

| Doc | Use |
|-----|-----|
| [`docs/spec-v1.2/`](docs/spec-v1.2/) | Current transformation specification |
| [`docs/product/PRODUCT-CONTRACT.md`](docs/product/PRODUCT-CONTRACT.md) | Product behavior contract |
| [`docs/product-mvp-architecture.md`](docs/product-mvp-architecture.md) | MVP architecture (current + historical lab notes) |
| [`docs/launch/LAUNCH-READINESS.md`](docs/launch/LAUNCH-READINESS.md) | Private beta / public launch planning |
| [`docs/deploy/RENDER.md`](docs/deploy/RENDER.md) | Hosted API + Postgres policy |
| [`docs/spec-v1.1/`](docs/spec-v1.1/) | Historical v1.1 spec (superseded) |
| [`lab/`](lab/) | Historical stylization / V4 research code |

---

## Safety

- Never commit `.env`, API keys, or database URLs.
- Never put provider secrets in the mobile app.
- Production fails closed: live xAI + Postgres policy required when `DOOJI_ENV=production`.
