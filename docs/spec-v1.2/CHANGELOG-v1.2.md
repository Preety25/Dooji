# Changelog — Transformation Spec v1.2

**Date:** 2026-10-02  
**Scope:** Intentional product-direction refinement for transformation behavior. Documentation + prompt/compiler alignment. No production provider switch, no mobile redesign, no paid provider runs in this pass.  
**Canonical source of truth:** [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md)  
**Previous set:** [`../spec-v1.1/`](../spec-v1.1/) (Recognition-Assisted Polish)

Updated documents:

- [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md) → **v1.2** (new canonical contract)
- [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) → v1.2
- [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) → v1.2
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) → v1.2 companion header / semantics language

---

## Summary

Refined transformation philosophy from strict doodle preservation toward **Intent-Preserving Stylized Reconstruction**. Dooji now explicitly treats the doodle as a rough design sketch and may substantially reconstruct geometry to improve clarity, polish, and stylization, while preserving subject identity, expression, pose, orientation, major proportions, and distinctive features.

Core principle:

> **Preserve the decisions, not the mistakes.**

Product promise:

> **Draw something messy. Dooji understands what you meant, cleans it up, and makes it beautiful.**

---

## What changed

- **Philosophy:** From geometry-first preservation with recognition assist → **semantic / expressive / compositional similarity** with aggressive cleanup of drawing execution.
- **Similarity definition:** Explicitly **not** pixel- or stroke-level. Exact contours are a reference, not a prison.
- **Anchor hierarchy:** Very strong anchors (identity, expression, pose, orientation, major proportions, distinctive features); flexible anchors (gesture, broad silhouette, placement, intentional asymmetry, color); low-priority disposable geometry (wobble, jaggedness, bad joins, gaps, stroke noise).
- **Conflict rule:** When exact source geometry conflicts with polish, preserve the creative anchor and release low-level geometry.
- **Semantic reconstruction budget:** Level **2 Reconstruct** is **normal/default** Dooji capability (not an edge case). Levels 0–2 allowed in normal use; Level 3 exceptional; Level 4 out of scope.
- **Expression / pose / angle:** Elevated to strong anchors. Poor facial marks should be reconstructed to preserve emotional intent — not literally traced.
- **Style:** Applied **after** reconstruction, and pushed hard (gummy / clay / plush / glossy remain first-class and distinct).
- **Anti-generic guardrails retained:** No stock/canonical replacement, no unsupported accessories/anatomy/faces. Strong semantic similarity + strong polish preferred over literal messy fidelity.
- **Evaluation:** Rewards intent recognition, anchor preservation, reconstruction quality, polish, style fidelity, authorship; does **not** fail renders merely for substantial geometry change.
- **Provider prompt contract:** Canonical reconstruction language replaces strict silhouette / exact-geometry wording in the production prompt compiler.

---

## What remained unchanged

- Provider-agnostic `ImageProvider` boundary; server-only credentials.
- `/v1/transform` contract, mobile flow, style IDs (`gummy` / `clay` / `plush` / `glossy`), library/result behavior.
- Style recipes own material/lighting/camera/presentation — **not** semantics.
- Dimensional ≠ extrusion guidance; transparent sticker presentation default.
- Production remains xAI-routed; this pass does not change providers.

---

## Previous rules intentionally relaxed

- **Strict silhouette / exact geometry preservation** as a primary hard constraint.
- Treating **Level 2** reconstruction as rare / highly conservative.
- Evaluating success primarily by contour / stroke fidelity.
- Prompt language that encouraged tracing messy strokes into 3D (“materialize the doodle”).

---

## Safeguards that still bind

1. User’s particular version remains the creative source of truth — reconstruct *their* object, never a stock substitute.
2. Evidence bar: reconstruct what a reasonable viewer would infer; do not invent unsupported details.
3. Budget ceiling: normal max **Level 2**; Level 3–4 not silent defaults.
4. Ambiguous blobs: do not force a confident wrong object reading.
5. Style layer never invents faces, accessories, or object parts.
6. Dual failure modes: wrong identity / lost anchors / generic redesign still fail even if beautiful.

---

*End of CHANGELOG-v1.2.md*
