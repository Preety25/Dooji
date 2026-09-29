# Golden-path: physical-device E2E (LAN + xAI)

**Status:** Known-good regression case (first successful live device generation)  
**Branch tip when recorded:** `product/mvp` @ `dba88c7`  
**Date recorded:** 2026-09-28  
**Do not spend credits to re-prove this unless intentionally re-running live E2E.**

---

## Known-good input / outcome

| Field | Value |
|---|---|
| Device | Physical Android phone via Expo Go |
| Doodle | Three concentric heart-shaped strokes |
| Style | `gummy` |
| Provider | `xai` / model `grok-imagine-image-2.0` |
| Provider defaults | resolution `1k`, quality `low`, `n=1` (server-side; not set by mobile) |
| Outcome | Real generated image shown on Expo result screen |
| Phone → API | `http://10.0.0.84:8080` |

Client analytics observed on the Metro session after the live provider switch:

- `transform_started` `{ "reason": "make", "style": "gummy" }`
- `transform_succeeded` `{ "style": "gummy" }`

---

## Working runtime configuration (no secrets)

### Laptop API process

| Variable | Working value | Notes |
|---|---|---|
| `IMAGE_PROVIDER` | `xai` | Required for live path |
| `DOOJI_HOST` | `0.0.0.0` | Phone must reach LAN bind (not `127.0.0.1`) |
| `DOOJI_PORT` | `8080` | |
| `XAI_API_KEY` | set in **server process env only** | Never print, never put in `mobile/.env`, never commit |
| `DOOJI_OUT` | unset in the known-good run | Optional; not required for mobile result |
| `PYTHONPATH` | repo root (`C:\Users\shahk\Documents\Dooji`) | So `python -m product.api.app` resolves |
| Bind verified | `0.0.0.0:8080` | |
| Health | `GET /health` → `{"status":"ok","service":"dooji-transform"}` | |

Start pattern (PowerShell, session-only key — do not persist to User/Machine unless intended):

```powershell
cd C:\Users\shahk\Documents\Dooji
# Provide XAI_API_KEY to this process only (value omitted from docs)
$env:IMAGE_PROVIDER = "xai"
$env:DOOJI_HOST = "0.0.0.0"
$env:DOOJI_PORT = "8080"
$env:PYTHONPATH = "C:\Users\shahk\Documents\Dooji"
python -m product.api.app
```

### Mobile (Expo)

| Variable | Working value |
|---|---|
| `EXPO_PUBLIC_TRANSFORM_MODE` | `http` |
| `EXPO_PUBLIC_TRANSFORM_API_URL` | `http://10.0.0.84:8080` |

File: `mobile/.env` (gitignored). Must not contain `XAI_API_KEY` or any provider secrets.

Expo: `npx expo start --lan` from `mobile/`.

### Network / firewall

- Laptop Wi‑Fi IPv4 for the known-good run: `10.0.0.84`
- Phone on same LAN (example phone IP seen earlier: `10.0.0.65`)
- Windows Firewall must allow inbound TCP to the Python API on `8080` (and Node/Expo on `8081` for Metro)

---

## Request / response path (verified)

```
Phone (Expo Go)
  → canvas raster PNG (base64) + strokes + style=gummy
  → HttpTransformClient
  → POST http://10.0.0.84:8080/v1/transform
       Content-Type: application/json
  → product.api.app.handle_transform
  → TransformService (IMAGE_PROVIDER=xai)
  → XAIImageProvider → lab.v4.generative.xai_edit
       model grok-imagine-image-2.0 (1k / low)
  → TransformResult status=ok + image_base64 (+ provider/model metadata)
  → HTTP 200 JSON (prompts / style sheets / API key never returned)
  → AppContext accepts status=ok + image_base64|image_url
  → result screen shows generated sticker
```

Contract notes that mattered for earlier LAN debugging (still required):

- Explicit `options.dry_run=true` → `status=dry_run`
- Normal mock or live success → `status=ok` when an image is returned  
  (fixed in `dba88c7`; live path already returned `ok`)

Mobile success gate (unchanged): `status === 'ok'` and (`image_url` or `image_base64`).

---

## Regression checklist (re-run)

### A. Zero-credit connectivity (mock)

1. `IMAGE_PROVIDER=mock`, same host/port bind, same `mobile/.env`.
2. Phone: health URL → draw → Make it ✨ → result sample image.
3. No `XAI_API_KEY` required.

### B. Live golden path (spends **one** credit)

1. Server: `IMAGE_PROVIDER=xai` + `XAI_API_KEY` present in API process.
2. Phone: three concentric hearts, style Gummy, Make it ✨.
3. Expect Metro `transform_succeeded` and a real image on the result screen.
4. Do not re-run casually.

### C. CI-safe automated coverage (no device)

```bash
python -m tests.product.test_transform_smoke
```

Asserts mock `dry_run=false` → `status=ok` + `image_base64`, and explicit dry-run → `status=dry_run`. Does **not** call xAI unless `DOOJI_LIVE=1`.

---

## Out of scope for this record

- No prompt / style-sheet / provider / mobile UX changes as part of documenting this case.
- No checked-in images or API keys.
- LAN IP may change on other networks; update `EXPO_PUBLIC_TRANSFORM_API_URL` accordingly.
