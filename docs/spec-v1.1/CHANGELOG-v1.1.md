# Changelog — Stylization Spec v1.1

> **Superseded:** Current product behavior is **v1.2 Intent-Preserving Stylized Reconstruction** — see [`../spec-v1.2/CHANGELOG-v1.2.md`](../spec-v1.2/CHANGELOG-v1.2.md) and [`../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md`](../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md). This changelog remains the v1.0 → v1.1 historical record.

**Date:** 2026-09-23  
**Scope:** Spec / art-direction update only. No Blender lab, recipe JSON, AI build, or implementation code changes.  
**Archived v1.0:** archive/v1.0 (not in repo)

Updated documents:

- [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) → v1.1
- [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) → v1.1
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) → v1.1

---

## What changed

- **Product intent:** Preserve authorship, but allow the system to recognize/infer what a messy doodle depicts when visual evidence is sufficient. Target reaction: *"That's what I was trying to draw — and now it looks amazing."*
- **New core principle — Recognition-Assisted Polish:** First-class product mode. Infer subject; selectively complete/repair structure for recognition and coherence; never replace with a canonical/generic/stock object. *"Complete MY rocket,"* not *"generate A rocket."*
- **Revised transformation spectrum (5 modes):** (1) Faithful → (2) Faithfully Polished → (3) Recognition-Assisted Polish → (4) Stylized / Interpreted → (5) Reimagined. Mode 3 is a valid default path, not a failure.
- **Semantic Completion vs Creative Reimagination:** Defined and separated. Only semantic completion is allowed in Recognition-Assisted Polish.
- **Semantic Completion Budget Levels 0–4:** Literal → Repair → Recognition Assist → Interpretation → Reimagination. Default may use Level 1 or 2 by confidence; Level 3–4 not default.
- **Recognition confidence bands:** HIGH / MEDIUM / LOW as internal engine concept — **no locked numeric thresholds** (experimental).
- **Preserve vs complete vs must-not-add:** Explicit lists for what to keep, what may be completed when strongly implied, and what must never be added for beauty.
- **Worked examples:** Plant, rocket, teddy, flower, rose, and ambiguous blob.
- **Face rule revision:** Style still never invents. Semantic layer may allow **limited facial completion** at HIGH confidence when a face is essential and cues exist. Cute face = semantic decision, not a style recipe decision.
- **Pipeline / architecture:** User strokes → canonical doodle → shape + semantic analysis → confidence → Transformation Plan → geometry → material → lighting → presentation → render. **Style must not determine semantic interpretation.**
- **Evaluation rubric:** Added **Semantic Recognition** and **Intent Preservation**. Fail if category is right but user's particular object is replaced by a stock version.
- **Updated promise:** Kept Product_v2 promise; added underlying intent: *"We can help your doodle become the thing you meant to draw."*
- **STYLE-RECIPES:** New §0.3a — style recipes do not own semantics; face/invention language updated for the semantic vs style split.

---

## What remained unchanged

- Core Product_v2 promise wording (messy → look good without stopping feeling like yours).
- Dimensional ≠ extrusion guidance and preferred inflation / bevel / shading / material / light stack.
- Hero styles and material intent for **glossy.v1 / gummy.v1 / clay.v1 / plush.v1** (geometry, material, lighting, camera, color, presentation starting ranges largely intact).
- Starting-range language for numerics (not locked finals).
- Lab relationship: specs are visual source of truth; **align lab later; do not modify lab now.**
- Non-goals for this phase: no Blender/lab edits, no AI build in this pass, no copying Recipe PDF characters.
- Citation of Product_v2 and Doodle-Emoji Recipe.pdf as art-direction references only.

---

## Previous rules intentionally relaxed

- **"Never invent anything" as absolute default** → replaced by evidence-gated **semantic completion** (budget Level 1–2) under Recognition-Assisted Polish.
- **Faithfully Polished as the only default** → Recognition-Assisted Polish is default when confidence is MEDIUM–HIGH; Faithfully Polished remains the path for LOW confidence.
- **Absolute "never add faces"** → limited facial completion **may** be allowed when semantic recognition strongly indicates a character/object whose face is essential, confidence is HIGH, and cues exist. User-drawn faces still preserved exactly; no anthropomorphizing objects/abstract doodles without cues.
- **Doodle-type tables that forbade all structural completion** → Level 1–2 completion allowed when confidence warrants.
- **Authorship check that treated any non-source mark as automatic failure** → completions that are strongly implied and budget-allowed can pass if Intent Preservation holds.

---

## Safeguards against generic AI reimagination

1. User's particular version is always the source of truth — complete *their* object, never a stock substitute.
2. Evidence bar: only **strongly implied** structure; creative reimagination forbidden in default Polish.
3. Budget ceiling: default max **Level 2**; Level 3–4 not silent.
4. Confidence gate: **LOW** → faithful stylization only; no forced object reading.
5. Ambiguity refusal: random blobs stay Faithfully Polished.
6. Preserve-first list: silhouette, proportions, gesture, asymmetry, distinctive shapes, placement, color relationships, user marks, quirks.
7. Must-not-add list: decorative accessories, arbitrary anatomy fixes, unrelated objects, generic character extras, identity-changing details, unsupported stock features.
8. Face split: style layer never invents; semantic layer only under explicit high-confidence rules.
9. Pipeline order: semantic/geometry plan **before** style; recipes cannot invent semantics.
10. Dual eval keys: **Semantic Recognition** and **Intent Preservation** both required — correct category + stock redesign = fail.

---

## Questions that must be tested experimentally

1. Where should HIGH / MEDIUM / LOW confidence thresholds sit (features, scores, agreement rules)? — **Do not lock in docs yet.**
2. When does Level 1 repair become Level 2 recognition assist in practice (gap size, part inference)?
3. How often does Recognition-Assisted Polish improve "meant to draw" ratings without harming "still feels like mine"?
4. Failure modes: false recognition (wrong object) vs under-recognition (missed clear subject) — which hurts more, and how should the engine bias?
5. Limited facial completion: which partial cue sets (dots, arcs, snout blanks) justify HIGH-confidence completion without sliding into auto-cute-face?
6. Silhouette preservation vs completion tradeoffs on crude drawings (poor drawers) — how much contour may move?
7. Cross-style stability: same Transformation Plan under glossy/gummy/clay/plush — does style ever leak semantics?
8. Rose / flower / plant edge cases: when is regularization still Intent Preserving vs canonicalization?
9. Eval inter-rater reliability for Semantic Recognition vs Intent Preservation as separate rubric rows.
10. Reproducibility metadata: minimum plan fields (mode, confidence band, budget level) needed for lab alignment later.

---

*End of CHANGELOG-v1.1.md*
