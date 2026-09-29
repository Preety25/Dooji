# Architecture

## 1. Purpose and Scope

This document describes **how Dooji is currently implemented** in the repository:

- mobile app architecture (Expo / React Native)
- application state and data model
- transformation pipeline (mobile → HTTP API → provider)
- API boundary and contracts
- image provider abstraction
- persistence and Library storage
- generation caching and deduplication
- generation lifecycle and error handling
- configuration / security boundaries
- testing boundaries

It describes **technical implementation**, not visual design.

Canonical product behavior lives in [`docs/product/PRODUCT-CONTRACT.md`](../product/PRODUCT-CONTRACT.md).  
Known-good physical-device E2E evidence lives in [`docs/golden-path-device-e2e.md`](../golden-path-device-e2e.md).

Where intended Product Contract behavior differs from code, sections call out:

- **Current implementation**
- **Intended behavior** (Product Contract)
- **Gap / follow-up**

---

## 2. System Overview

Actual runtime path for a live LAN + xAI generation:

```
Mobile App (Expo / React Native)
  ├─ Canvas / Preview / Generating / Result / Library screens
  ├─ AppContext (product state machine)
  ├─ generation/ (cache + ensureStyleAsset)
  └─ TransformClient
        ├─ mock  → bundled sample PNGs (default)
        └─ http  → POST {EXPO_PUBLIC_TRANSFORM_API_URL}/v1/transform
              ↓
Dooji Transform API (product/api/app.py, stdlib HTTP)
              ↓
TransformService (product/transform/service.py)
              ↓
Style loader (product/styles/{id}.json) + prompt compiler
              ↓
ImageProvider (product/providers)
              ├─ mock  (IMAGE_PROVIDER=mock)
              └─ xai   (IMAGE_PROVIDER=xai → lab.v4.generative.xai_edit)
                    ↓
              xAI / Grok Imagine (grok-imagine-image-2.0)
              ↓
Post-process seam (MVP stubs / light normalize)
              ↓
TransformResult JSON (image_base64 + metadata; prompts never returned)
              ↓
Mobile: upsert GeneratedAsset → Result / Library
```

Mobile never receives provider keys, prompts, or style-sheet binaries. It sends doodle raster + strokes + style and receives a provider-agnostic `TransformResult`.

---

## 3. Mobile Architecture

| Layer | Actual stack / location |
|---|---|
| Runtime | React Native + Expo SDK ~57 |
| Language | TypeScript |
| Routing | Expo Router — screens under `mobile/src/app/` |
| State | React Context reducer in `mobile/src/state/AppContext.tsx` |
| Domain models | `mobile/src/models/types.ts` |
| Transform client | `mobile/src/transform/` (`client`, `httpClient`, `mockClient`, `contracts`) |
| Generation / cache | `mobile/src/generation/` |
| Product flow helpers | `mobile/src/product/` (`flow`, `generationGuard`) |
| Persistence | AsyncStorage via `mobile/src/storage/library.ts` |
| Usage / entitlement | `mobile/src/usage/entitlement.ts` (AlwaysAllow placeholder) |
| Analytics | `mobile/src/analytics/events.ts` |

### Routes (Expo Router)

| Route file | Phase / role |
|---|---|
| `index.tsx` | Canvas |
| `preview.tsx` | Preview (style pick / Surprise me) |
| `generating.tsx` | Generating |
| `result.tsx` | Result |
| `library.tsx` | Library |

Non-route UI lives under `mobile/src/components/` (e.g. `DoodleCanvas`, `StyleSelector`, `Feedback`).

### Separation of concerns

- UI screens dispatch through `AppContext`; they do not call xAI.
- `TransformClient` is the only mobile I/O boundary for generation.
- Provider selection (`IMAGE_PROVIDER`) and secrets stay on the Python server.

---

## 4. Product State Model

### Current implementation

`AppPhase` (`mobile/src/product/flow.ts`):

| Phase | Meaning in code |
|---|---|
| `canvas` | Drawing / editing strokes |
| `preview` | Style choice after Make it ✨; `selectedStyle` starts `undefined` |
| `generating` | In-flight transform after cache miss |
| `result` | Viewing / selecting generated assets |

`AppState` (AppContext) also tracks:

| Field | Kind | Notes |
|---|---|---|
| `creation` | Persistent Creation data | Strokes, assets, jobs, `saved` flag |
| `phase` | Temporary UI | Product phase |
| `selectedStyle` | Temporary UI | Request / selection target; **not** the same as `Creation.style` |
| `activeAssetId` | Temporary UI | Which `GeneratedAsset` is shown |
| `activeJob` | In-flight | Current `GenerationJob` when generating |
| `lastError` | Temporary UI | Technical failure message |
| `semanticWarning` | Temporary UI | Set only from server metadata flags |
| `dirty` | Temporary UI | Meaningful unsaved Creation changes |
| `newDoodlePrompt` | Temporary UI | New Doodle confirmation dialog model |
| undo/redo stacks | Temporary UI | Stroke history on Canvas |

`GenerationGuard` (`mobile/src/product/generationGuard.ts`) tracks the in-flight request key and sequence for dedupe + stale-response protection.

### Transitions (current)

| From | Action | To |
|---|---|---|
| canvas | Make it ✨ / openPreview (requires strokes) | preview (`selectedStyle` cleared) |
| preview | Tap style tile | generating **or** result (cache hit) |
| preview | Surprise me ✨ | same as style tap after random pick |
| generating | success | result |
| generating | failure | stays with `lastError` (Feedback / Retry) |
| result | Tap cached style | stay result, swap `activeAssetId` |
| result | Tap uncached style | stay result, set `selectedStyle` only |
| result | Make it [Style] ✨ CTA | generating **or** instant cache |
| any | Edit doodle | canvas |
| any | New Doodle (after prompts) | new blank Creation + canvas |

### Distinctions

| Concept | Persistent? | Notes |
|---|---|---|
| Creation + assets | Yes (when saved to Library; also held in memory) | Strokes are source of truth |
| `selectedStyle` | No | UI selection / generation target |
| `activeAssetId` | No (hint stored in Creation.metadata on Save) | Displayed hero asset |
| In-flight job / guard | No | Cleared on complete / invalidate |

**Intended vs current:** Product Contract Preview rules (no default selection, immediate tile generation, Surprise me, **no user doodle on Preview**) match the interaction wiring. UI chrome is still logic-host / interim visuals pending Design Handoff.

---

## 5. Core Data Model

Defined primarily in `mobile/src/models/types.ts`, mirrored on the server by `product/transform/contracts.py` for the wire format.

| Model | Role |
|---|---|
| `StyleId` | `'gummy' \| 'clay' \| 'plush' \| 'glossy'` |
| `StyleInfo` / `STYLES` | Display label + short blurb for UI |
| `DoodleStroke` / `StrokePoint` | Canonical doodle geometry (color, width, tool, points) |
| `Doodle` | Canvas size + strokes (composition helper) |
| `Creation` | One original doodle identity + assets + jobs + saved flag |
| `GeneratedAsset` | One derived render for a style + source fingerprint + versions |
| `GenerationJob` | Client-side job record (queued/running/succeeded/failed/cancelled) |
| `TransformRequest` | Mobile→API payload (style, doodle_base64, strokes, options) |
| `TransformResult` | API→mobile payload (status, image_base64, metadata, …) |

### Relationships

```
Creation (id)
  ├─ strokes[] + canvas          ← canonical source
  ├─ style                       ← last-successful / preference field (not UI selection)
  ├─ assets[] → GeneratedAsset
  │                 ├─ style, imageUri
  │                 ├─ doodleFingerprint
  │                 ├─ transformVersion / styleVersion / semanticVersion
  │                 └─ provider, metadata, createdAt
  └─ jobs[] → GenerationJob
```

`DEFAULT_STYLE = 'gummy'` initializes **`Creation.style`** on a new Creation. It is **not** used as the Preview UI default selection (`selectedStyle` starts `undefined` on `open_preview`).

---

## 6. Creation and Asset Model

### Creation

| Field | Meaning |
|---|---|
| `id` | Stable Creation identity (`newId`) |
| `strokes` / `canvas` | Canonical doodle |
| `doodlePreviewUri` | Optional raster preview after generation capture |
| `style` | Last successfully generated style preference |
| `assets` | Generated style variants (history may include prior fingerprints) |
| `jobs` | Generation attempts |
| `saved` | Explicit Library save flag |
| `createdAt` / `updatedAt` | Timestamps |
| `metadata` | e.g. last active asset / selected style hints on Save |

### GeneratedAsset identity

An asset is considered a **valid cache hit** for reuse when all match (`lookupCachedAsset`):

- `creationId`
- `style`
- `doodleFingerprint` (FNV-1a over strokes + canvas)
- `transformVersion` (`product.mvp.v1`)
- `styleVersion` (from `product/styles` / mobile `STYLE_VERSIONS`)
- `semanticVersion` (`product.mvp.semantic.v1`)

Image representation on mobile: `imageUri` as a local/data URI (typically `data:image/png;base64,…` from `image_base64`, or `image_url` if present).

Provider/model metadata may be stored on the asset from `TransformResult` but is not required for cache identity.

---

## 7. Transformation API

### Endpoint

`POST /v1/transform` on the stdlib server in `product/api/app.py`.

Also: `GET /health` and `GET /v1/health` → `{ "status": "ok", "service": "dooji-transform" }`.

### Request (JSON, mobile-facing)

| Field | Required | Notes |
|---|---|---|
| `style` | yes | one of gummy/clay/plush/glossy |
| `doodle_base64` | preferred | PNG base64; primary identity |
| `strokes` | preferred | Canonical stroke JSON |
| `client_doodle_id` | optional | Creation id |
| `options.size` | optional | default 1024 |
| `options.dry_run` | optional | forces mock provider + `status=dry_run` |
| `options.recognition` | optional | server/tests only; not required from mobile |

Accepted aliases: `doodle_png_base64`; server-local `doodle_path` for ops/smoke.

### Response

| Field | Notes |
|---|---|
| `status` | `ok` \| `error` \| `dry_run` |
| `style` | echoed |
| `transform_version` | `product.mvp.v1` |
| `provider` / `model` | e.g. `xai` / `grok-imagine-image-2.0` |
| `image_base64` | primary mobile image payload |
| `image_path` / `image_url` | optional; path only if `DOOJI_OUT` set |
| `error` | on failure |
| `metadata` | style_version, recognition_id, postprocess notes, provider meta **without prompts** |

HTTP: `200` for `ok`/`dry_run`; `502` for transform `error`; `400` for bad JSON/validation.

### Why mobile must not hold provider secrets

The mobile contract is provider-agnostic. xAI keys, prompts, and style sheets remain server-side so:

- secrets are not shipped in Expo public env
- providers can change without changing mobile UX
- prompts never round-trip to the client

---

## 8. Transformation Pipeline

Actual sequence:

1. **User doodle** — strokes on Canvas (`DoodleCanvas`).
2. **Make it ✨** — enter Preview; **no** transform call.
3. **Style tap / Surprise me** (Preview) or **Make it [Style] ✨** (Result) — `runCreateStyle`.
4. **Cache lookup** — `lookupCachedAsset` before entitlement / generating UI.
5. **Raster capture** — `DoodleRasterCapture` / view-shot → PNG base64.
6. **Stroke payload** — `toStrokeJson` complements PNG.
7. **TransformClient.transform** — mock or HTTP.
8. **API** — `parse_transform_body` → `TransformService.transform`.
9. **Ingest** — prefer client PNG; else path; else stroke raster fallback.
10. **Style config** — `load_style` from `product/styles/{id}.json`.
11. **Recognition default** — minimal scaffold (`default_recognition`); optional override via `options.recognition`.
12. **Prompt compile** — `compile_prompt` (V4.4 doctrine + style pack); prompt stays server-side.
13. **Provider.generate** — mock PNG or xAI Imagine edit (`1k` / `low` / `n=1` defaults).
14. **Post-process** — seam exists; MVP mostly passthrough / light RGBA normalize.
15. **TransformResult** — base64 image + metadata.
16. **Mobile** — `upsertStyleAsset`, set phase result, optional Library upsert if already `saved`.

---

## 9. Provider Abstraction

### Design

`ImageProvider` protocol (`product/providers/base.py`):

- `generate(ProviderGenerateRequest) → ProviderGenerateResult`
- Inputs: doodle PNG bytes, compiled prompt, optional style-ref PNGs
- Outputs: image bytes + provider/model/error/metadata

Factory: `product.providers.get_provider()` via `IMAGE_PROVIDER=xai|mock` (default: xAI if key present, else mock).

### Current implementations

| Provider | Class | Behavior |
|---|---|---|
| mock | `MockImageProvider` | Returns a real image without calling xAI; used for LAN dry testing |
| xai | `XAIImageProvider` | Thin adapter over `lab.v4.generative.xai_edit`; model `grok-imagine-image-2.0` |

### Replaceability

**Design intent:** swap providers without changing the mobile UX contract (`TransformRequest` / `TransformResult`).

**Current implementation:** factory + protocol support mock and xAI today. Other vendors are not implemented. Substitution is practical at the server provider seam, not via mobile config.

Credentials: `XAI_API_KEY` read only from server process environment; never logged or returned.

---

## 10. Style Configuration and Versioning

| Layer | Location |
|---|---|
| Style packs | `product/styles/{gummy,clay,plush,glossy}.json` |
| Style sheets | `product/assets/style_sheets/` (+ docs/refs fallbacks) |
| Loader | `product/transform/styles.py` → `StyleConfig` |
| Prompt doctrine | `product/transform/prompt_compiler.py` (+ lab V4.4 fragments) |
| Transform version | `product.mvp.v1` (`product/__init__.py` and mobile contracts) |
| Mobile cache pins | `STYLE_VERSIONS` + `SEMANTIC_VERSION` in `mobile/src/generation/versions.ts` |

Style JSON includes version, display name, material/form/lighting language, forbidden list, prompt fragments, and sheet paths. Prompt text is compiled server-side and is **not** duplicated here.

Changing transform / style / semantic versions invalidates cache compatibility for prior assets.

---

## 11. Caching and Generation Deduplication

### Current implementation

**Module:** `mobile/src/generation/cache.ts` + `ensure.ts` + AppContext `runCreateStyle`.

**Cache key dimensions:** Creation id + style + doodle fingerprint + transform/style/semantic versions.

| Event | Behavior |
|---|---|
| Cache hit | Activate asset immediately; no Transform API; no `usage.record('transform')`; no generating UI |
| Cache miss | One `ensureStyleAsset` → one `client.transform` |
| Duplicate in-flight same key | `GenerationGuard.begin` returns `null`; second request skipped |
| Stale response | `canApplyGeneratedAsset` + guard `isCurrent` drop apply if Creation/fingerprint/seq changed |
| Entitlement | Checked **after** cache miss decision; `AlwaysAllowUsage` currently always allows |

`upsertStyleAsset` keeps at most one current asset per style **for a given fingerprint**; other-fingerprint assets for that style may remain until replaced. Validity for display/reuse is always via `lookupCachedAsset`.

---

## 12. Persistence and Library Storage

| Item | Actual |
|---|---|
| Backend DB | **None** for MVP Library |
| Storage | `@react-native-async-storage/async-storage` |
| Key | `dooji.library.v1` |
| Operations | `loadLibrary`, `saveLibrary`, `upsertCreation`, `removeCreation` |
| Persisted shape | Array of `Creation` JSON (strokes, assets, jobs, flags, …) |

**Save vs generation:** Successful generation upserts the asset onto the in-memory Creation and, if `creation.saved`, also upserts Library. Generation alone does not set `saved: true`.

Library is Creation-first: one list entry per Creation; styles are nested `assets`.

---

## 13. Edit / Source Invalidation

### Current implementation

- Edit doodle → `phase = canvas`; assets are **not** blindly deleted.
- Stroke add / undo / redo / clear → `dirty: true`, `GenerationGuard.invalidateAll()`.
- Cache validity uses **doodle fingerprint**: edited strokes produce a new fingerprint; prior assets remain in `creation.assets` history but are not valid hits for the new source.
- `clearGeneratedAssets` exists as a helper but is not the default edit path.

### Intended behavior (Product Contract)

- No actual change → existing assets remain valid (matches fingerprint equality).
- Source change → old assets must not be treated as current (matches fingerprint gating).
- History may remain (matches current upsert/filter strategy).

---

## 14. Error Handling

### Client

| Mechanism | Behavior |
|---|---|
| Transform `status !== ok` or missing image | `generation_err`; user-facing copy currently **"That one got a little weird."**; Retry + Edit doodle via Feedback |
| Raster capture failure | Treated as generation error (no API call) |
| Entitlement deny | Same error path (placeholder; AlwaysAllow never denies) |
| Semantic warning | `readSemanticUncertainty(metadata)` — flags `semantic_uncertain`, `interpretation_uncertain`, or low/uncertain confidence |
| Dry-run / mock HTTP | Mock provider returns real `image_base64` with `status=ok` unless `options.dry_run` |
| Stale async | Guard drops apply |

**Try Another:** not present in mobile UI, handlers, or analytics (aligned with Product Contract removal).

### Server

| Mechanism | Behavior |
|---|---|
| Ingest / validation errors | `status=error` or HTTP 400 |
| Provider failure | `status=error`, HTTP 502 from API handler |
| `dry_run` | Forces mock provider; response `status=dry_run` (mobile treats non-`ok` as failure — dry_run is for explicit client opts) |
| Prompts | Never included in response body |

### Gap

- **Current:** Technical failures use “weird” copy; backend does **not** currently emit `semantic_uncertain` in TransformService metadata.
- **Intended:** Clear technical error + Retry/Edit; “A little mysterious” only for trustworthy server semantic signal; Keep it weird / Edit doodle.
- **Follow-up:** Align error copy and optional server semantic signals with Product Contract §13.

---

## 15. Configuration and Environment

### Server-only

| Variable | Role |
|---|---|
| `XAI_API_KEY` | xAI credential; never print/log/commit; never put in mobile env |
| `IMAGE_PROVIDER` | `xai` \| `mock` |
| `DOOJI_HOST` | Bind host (default `0.0.0.0` for LAN) |
| `DOOJI_PORT` | Bind port (default `8080`) |
| `DOOJI_OUT` | Optional persist root for generated PNGs |
| `PYTHONPATH` | Repo root when running `python -m product.api.app` |
| `DOOJI_LIVE` | Test gate for live smoke (tests only) |

### Client-safe (Expo public)

| Variable | Role |
|---|---|
| `EXPO_PUBLIC_TRANSFORM_MODE` | `mock` (default) \| `http` |
| `EXPO_PUBLIC_TRANSFORM_API_URL` | Base URL for HTTP client (default `http://127.0.0.1:8080`) |

Local-development: `mobile/.env` (gitignored) typically sets LAN URL for device E2E. See `.env.example` and `mobile/.env.example` — placeholders only; no secrets.

---

## 16. Security Boundaries

- Provider credentials are **server-side only**.
- Mobile **never** calls xAI directly and must not embed `XAI_API_KEY`.
- Transform responses must not include compiled prompts or raw keys (`XAIImageProvider` strips prompt and refuses metadata that echoes the key).
- `.env` / secret files remain gitignored; docs and tests assert key absence from payloads where applicable.
- API logging avoids Authorization headers / body key material.

---

## 17. Testing

| Area | Location | What it verifies |
|---|---|---|
| Generation cache | `mobile/src/generation/generationCache.test.ts` | Fingerprint, compatibility, upsert, ensure cache-hit/miss |
| Product flow | `mobile/src/product/productFlow.test.ts` | New Doodle prompts, Surprise pick, semantic metadata reader, request keys, CTA labels |
| Transform API smoke | `tests/product/test_transform_smoke.py` | Mock/live gates, dry_run semantics, no key leakage |
| Device E2E (documented) | `docs/golden-path-device-e2e.md` | Known-good LAN + xAI heart/gummy path — **do not re-spend to re-prove casually** |
| Lab / eval scripts | `scripts/`, `lab/v4/` | Research / regression; not the mobile product state machine |

Mock vs live: mobile defaults to local mock client; HTTP + `IMAGE_PROVIDER=mock|xai` for LAN. Live xAI tests require explicit env and spend credits.

Known limitations: post-process stubs; AlwaysAllow entitlement; minimal default recognition (no full VLM lock in MVP path).

---

## 18. Current Known Gaps

Only gaps observed between Product Contract intent and current code/docs:

| Topic | Current implementation | Intended behavior | Gap / follow-up |
|---|---|---|---|
| Semantic uncertainty UX | Client can read server flags; server TransformService does not emit `semantic_uncertain` today | Show “A little mysterious” only on trustworthy server signal | Backend signal + distinct Result UX when ready |
| Technical error copy | Failures often surface “That one got a little weird.” | Clear technical error; Retry is technical-only | Copy / Feedback alignment |
| Credits / entitlement | `AlwaysAllowUsage` always allows; counts transforms in memory | Cache-before-credit; real entitlement when productized | Replace placeholder when pricing exists |
| Post-processing | Stub passthrough / light normalize | Full bg removal / edge / crop seam | Implement behind existing seam |
| Recognition | Minimal `default_recognition` scaffold; doodle PNG is primary identity | Authorship-preserving transform without fake client “weirdness” | Richer recognition optional later; not a client detector |
| Visual design | Logic-host screens (Preview/Result/etc.) | Premium playful UI per `docs/design/DESIGN-HANDOFF.md` | Visual implementation pass |
| Result generated indicator | `StyleSelector` highlights `selected` only; `selectedStyleIsGenerated` drives CTA visibility | Generated styles show checkmark; ungenerated styles do not | Add per-style “generated for current source” affordance in UI |
| Preview presentation | Interim `preview.tsx` is logic-host chrome (e.g. stroke-count meta, “Your doodle · pick a style”); does not yet match approved Preview comps; static material orb assets not wired | Preview shows header + “Pick a style for your Dooji” + 2×2 static Gummy/Clay/Plush/Glossy tiles + Surprise me ✨ · **no user doodle** · no generation CTA | Update Preview presentation during visual implementation; keep tile/Surprise → cache/generate behavior |
| `Creation.style` default | New creations set `style: 'gummy'` as data preference | Preview must not default-select Gummy in UI | Already separated via `selectedStyle: undefined` on Preview — keep that invariant |

Preview immediate-generate, Result CTA-for-missing-style, cache-before-API, Surprise me randomness, Save vs generate, New Doodle prompts, and Library Creation-first model are implemented in the mobile product layer audited above.

---

## 19. Architecture Principles

Supported by the current project structure:

- Original doodle / stroke data is canonical.
- Generated renders are derived and version/fingerprint-scoped.
- Mobile UI is provider-agnostic (`TransformClient` only).
- Provider credentials remain server-side.
- Styles are versioned configuration (`product/styles/*.json`), not hard-coded mobile prompts.
- Cache before unnecessary generation and credit use.
- Avoid duplicate in-flight generation for the same Creation + fingerprint + style.
- Preserve source identity across edit / retry via fingerprints and stale-response guards.
- Keep AI infrastructure replaceable at the server `ImageProvider` seam where practical.

---

## 20. Document Status

**Status:** Current MVP architecture  

**Owner:** Engineering / Product Design  

**Note:** This document defines **HOW** Dooji is implemented. Product behavior belongs in [`docs/product/PRODUCT-CONTRACT.md`](../product/PRODUCT-CONTRACT.md). Visual design will eventually belong in `docs/design/DESIGN-HANDOFF.md`. Preserve [`docs/golden-path-device-e2e.md`](../golden-path-device-e2e.md) as the device E2E evidence record.
