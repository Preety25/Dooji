# Dooji Launch Readiness

Planning document for private beta and public launch.  
This is **not** a commitment that every item must be finished immediately.

**Baseline reference:** tag `v0.1.0` on `product/mvp`.

---

## Current baseline

| Item | Value |
|------|--------|
| Release tag | `v0.1.0` |
| Verified production commit | `6e1ed7ea1ce40683b00a03631f8db0ca052e6222` |
| Branch | `product/mvp` |
| Production API | Render `dooji-api` — `https://dooji-api.onrender.com` |
| Generation policy | Postgres-backed anonymous quota + global budget + kill switch |
| Styles | Gummy, Clay, Plush, Glossy |
| Production provider | xAI / `grok-imagine-image-2.0` |
| Mobile | Expo / React Native / TypeScript MVP (canvas → generate → result → library) |
| Transformation doctrine | v1.2 Intent-Preserving Stylized Reconstruction |

**Known limitation:** live generation can take roughly **a minute** end-to-end. Treat latency as expected MVP behavior until a dedicated performance pass.

Verified capabilities in this baseline:

- Hosted transform API with fail-closed production config
- Mobile HTTP connectivity to the hosted API
- Multi-style generation with on-device Library / cache identity aligned to style versions
- Mock path for local/CI work without consuming AI credits

---

## Before private beta

- [ ] Production iOS and Android builds (dev client / TestFlight / internal track — not Expo Go–only)
- [ ] Multiple physical-device tests (different phones, OS versions, network conditions)
- [ ] Privacy / data-flow review (what leaves the device, what the API stores, retention)
- [ ] Generation failure / network / timeout / rate-limit UX testing
- [ ] Verify quota exhaustion and kill-switch (`DOOJI_GENERATIONS_DISABLED`) behavior on the hosted API
- [ ] Basic analytics / event instrumentation suitable for beta learning (beyond local console placeholders)
- [ ] Lightweight beta feedback mechanism (form, email, or in-app channel)

---

## Before public launch

- [ ] Performance investigation (generation latency, cold starts, timeouts, perceived wait)
- [ ] Reliability and edge-case testing (empty doodles, huge strokes, offline, backgrounding, cache invalidation)
- [ ] App Store and Google Play requirements checklist
- [ ] Privacy policy and in-product data disclosures
- [ ] Production build and distribution testing (signing, updates, rollback plan)
- [ ] App icon, screenshots, store copy, and support contact information

---

## Post-launch backlog

- Generation latency improvements
- Semantic completion / reconstruction quality improvements (still within v1.2 doctrine)
- Provider evaluation (quality, cost, transparency, latency)
- Richer sharing and integrations
- Additional styles

---

## Related docs

| Doc | Role |
|-----|------|
| [`../product-mvp-architecture.md`](../product-mvp-architecture.md) | Current architecture |
| [`../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md`](../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md) | Transformation contract |
| [`../product/PRODUCT-CONTRACT.md`](../product/PRODUCT-CONTRACT.md) | Product behavior contract |
| [`../deploy/RENDER.md`](../deploy/RENDER.md) | Hosted API + Postgres ops |
| [`../golden-path-device-e2e.md`](../golden-path-device-e2e.md) | Historical LAN device E2E record |
