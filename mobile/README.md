# Dooji mobile MVP (Expo / React Native / TypeScript)

Canvas-first doodle → transform → sticker experience. Default **MOCK** mode — no xAI keys, URLs, prompts, or payloads on device.

## Run

```bash
cd mobile
npm install
npm start          # Expo Go / dev client
# optional:
npm run ios
npm run android
npm run web
```

### Transform mode

| Env | Effect |
|---|---|
| `EXPO_PUBLIC_TRANSFORM_MODE=mock` (default) | Local `MockTransformClient` returns bundled V4-style sample PNGs |
| `EXPO_PUBLIC_TRANSFORM_MODE=http` | `HttpTransformClient` → `POST {EXPO_PUBLIC_TRANSFORM_API_URL}/v1/transform` |
| `EXPO_PUBLIC_TRANSFORM_API_URL` | Default `http://127.0.0.1:8080` |

### Live xAI (server only)

```bash
# repo root — ONE gummy generation (1k / low / n=1)
export XAI_API_KEY=...          # never put this in mobile env
export IMAGE_PROVIDER=xai
export DOOJI_LIVE=1
export DOOJI_OUT=out/product/live_slice
python3 -m scripts.run_live_gummy_once

# then point the app at the live API (simulator / same machine)
IMAGE_PROVIDER=xai python3 -m product.api.app
# mobile/
EXPO_PUBLIC_TRANSFORM_MODE=http \
EXPO_PUBLIC_TRANSFORM_API_URL=http://127.0.0.1:8080 \
npm start
```

### Physical phone (same Wi-Fi) — device E2E

Run the API **on the computer that shares Wi-Fi with the phone** (not a Cloud Agent VM).

```bash
# Terminal 1 — repo root (server only; key stays here)
pip install -r requirements-product.txt
export XAI_API_KEY=...          # never put this in mobile env
export IMAGE_PROVIDER=xai
export DOOJI_HOST=0.0.0.0
export DOOJI_PORT=8080
python3 -m product.api.app

# Terminal 2 — discover LAN IP, then start Expo
#   macOS:  ipconfig getifaddr en0
#   Linux:  hostname -I | awk '{print $1}'
cd mobile
cp .env.example .env            # then set EXPO_PUBLIC_TRANSFORM_API_URL=http://YOUR_LAN_IP:8080
npm install
npx expo start --lan
```

Phone: open Expo Go → scan the QR → draw → **Make it ✨**.  
Sanity check from the phone browser first: `http://YOUR_LAN_IP:8080/health` → `{"status":"ok",...}`.

Mobile never receives `XAI_API_KEY`, xAI URLs, or prompts. TransformRequest carries
`doodle_base64` (canvas PNG) + `strokes` + `style`.

## Architecture

```
Mobile UI (TransformRequest / TransformResult only)
    → src/transform getTransformClient()
         ├─ MockTransformClient   (default demo)
         └─ HttpTransformClient   (POST /v1/transform)
              → product/api → TransformService → ImageProvider
                   ├─ MockImageProvider  (CI / local)
                   └─ XAIImageProvider   (server only — never in this app)
```

## Layout

```
mobile/
  src/app/           Expo Router screens (canvas, generating, result, library)
  src/components/    Canvas, toolbar, style selector, soft buttons
  src/models/        Creation, GeneratedAsset, strokes, styles
  src/transform/     Contracts + mock/http clients
  src/state/         App context (strokes = source of truth)
  src/storage/       AsyncStorage library
  src/analytics/     Typed local event log
  src/usage/         Entitlement placeholder (no pricing UI)
  src/design/        Tokens (type, spacing, radius, color, motion)
  assets/mock/       Curated style sample PNGs for MOCK mode
```

Primary flow: Open → Canvas → Draw → Make it ✨ → Generating → Result → styles / save / share / edit / try another → Library / New doodle.

Default first style: **Gummy** (no style pick required before first transform).
