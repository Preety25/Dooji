# Stylization Spec — Doodle Emoji

> **Superseded for current product behavior by [`../spec-v1.2/`](../spec-v1.2/)** — Intent-Preserving Stylized Reconstruction. Keep this file as the v1.1 historical record.

**Document role:** Visual source of truth for the transformation engine (v1.1).  
**Status:** Historical — superseded by stylization-spec.v1.2  
**Version:** stylization-spec.v1.1 (2026-09-23)  
**Previous:** 1.0 archived at archive/v1.0 (not in repo)  
**Sources:** Product_v2; Doodle-Emoji Recipe.pdf (art-direction reference only — do not reproduce specific characters)

**Companion documents:**
- [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) — Recognition-Assisted Polish, spectrum 1–5, completion budget, confidence, preserve/complete, face rule, examples
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) — versioned recipes for `glossy.v1`, `gummy.v1`, `clay.v1`, `plush.v1` (styles do not own semantics)
- [`CHANGELOG-v1.1.md`](./CHANGELOG-v1.1.md) — concise v1.0 → v1.1 summary
- Local reference copy: [`../Product_v2.md`](../Product_v2.md)

---

## 1. Purpose

This specification defines how Doodle Emoji turns an imperfect user doodle into a polished, style-specific, shareable render **without replacing the user's authorship**, while allowing **recognition-assisted completion** when visual evidence supports it.

It binds:

- Updated product promise and emotional outcome
- Recognition-Assisted Polish as a first-class default path (when confidence supports it)
- Conceptual pipeline / architecture (semantic interpretation **before** style)
- Dimensional stylization (vs extrusion)
- Transformation spectrum and engine behavior integrating budget + confidence
- Style-family summary (full recipes elsewhere; styles do not invent semantics)
- Engine behavior by doodle type (Level 1–2 completion when warranted)
- Evaluation rubric including Semantic Recognition and Intent Preservation
- Versioning / reproducibility expectations
- Explicit non-goals for this phase

Implementations (procedural renderers, labs, future pipelines) must align to this document. Prior Blender lab recipe JSON files are drafts to be updated later; **this spec is the visual source of truth**. Do not modify lab files as part of adopting this document set.

This phase defines a **behavioral contract**. Recognition may be implemented later (lab / future); do not build AI or change implementation code as part of this documentation pass.

---

## 2. Emotional outcome and product promise

**Promise (Product_v2 — retained):**

> Draw something messy. We will make it look good without making it stop feeling like yours.

**Underlying intent (v1.1):**

> We can help your doodle become the thing you meant to draw.

**Moat:** Authorship-preserving recognition + distinctive stylization + delightful reveal.

**Target user reaction:**

> That's what I was trying to draw — and now it looks amazing.

**Anti-outcome:**

> An exact extrusion of messy strokes that technically preserved everything but doesn't look like the thing.

Success requires **both** correct subject recognition (when cues suffice) **and** retention of the user's particular version. A beautiful generic object is a failure of Polish even if recognition of "category" is correct. A literal mess that never reads as the intended subject is also a failure of the product experience for poor drawers with clear cues.

---

## 3. Polish with recognition assist (not replace)

Polish improves and, when warranted, **completes** the user's mark. It does not invent a better, stock drawing.

| Do | Do not |
|----|--------|
| Infer subject when visual evidence is sufficient | Force an object reading on ambiguous blobs |
| Repair broken connections / tiny gaps (Level 1) | Creative reimagination (cute extras unsupported by source) |
| Add strongly implied structural details for recognition (Level 2) when confidence supports it | Replace user's weird/particular object with a canonical/store-bought version |
| Add dimension, lighting, depth, material, polish, clean transparency | Let style recipes invent faces, accessories, or object parts |
| Preserve asymmetry, quirks, gesture, color relationships | Arbitrary anatomy correction "because it looks better" |
| Limited facial completion only when semantic rules allow (HIGH confidence + essential cues) | Auto-cute-face every object from style sheets |

**Face rule (summary):** user-drawn face → preserve exactly; partial teddy/animal facial cues + HIGH confidence → limited completion MAY be allowed; no character cues / abstract → do not invent. **Cute face = semantic decision, not a style recipe decision.** Full rule: [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) §9.

---

## 4. Dimensional stylization (prominent)

### 4.1 Shared form language

Across hero styles, forms should feel:

- Pillowy / inflated / pressurized more than prismatic
- Extremely rounded with heavy fillets (no sharp corners)
- Softly merged at junctions, with AO in crevices
- Stuffed or pressed, not hard-edged extrusions

### 4.2 Dimensional ≠ visible side extrusion

**Critical:** Do not equate "3D" or "polish" with obvious side extrusion walls.

**Preferred stack (in order), after the Transformation Plan:**

1. **Silhouette-aware inflation / bulge**
2. **Soft bevel / fillet**
3. **Curved shading response**
4. **Material SSS / sheen / specular**
5. **Lighting** (key / fill / rim / AO)
6. **Subtle camera pitch / yaw** only if the silhouette still reads as the user's particular object

Hard visible extrusion walls are a **last resort / style-specific option**, not the default definition of polish.

Art-direction transform examples (e.g. rough rose → glossy rose) sell depth through inflated smooth volumes, speculars, and SSS edge glow while keeping petal count, spiral, and leaf placement — not through showing thick extruded side walls. Semantic completion of a rose (when confidence is high) still preserves the user's spiral and proportions; it does not substitute a florist catalog rose.

---

## 5. Transformation spectrum and default mode

Full definitions: [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) §§2–6.

```text
1 Faithful
2 Faithfully Polished
3 Recognition-Assisted Polish   ← first-class; default when confidence supports it
4 Stylized / Interpreted
5 Reimagined
```

| Mode | Engine stance |
|------|----------------|
| 1 Faithful | Near-literal; debug / before |
| 2 Faithfully Polished | Identity locked; material/light/volume; Level 0–1 only | Valid default when confidence is LOW |
| **3 Recognition-Assisted Polish** | Infer subject; Level 1–2 semantic completion when warranted; then style | **Default product path when confidence is MEDIUM–HIGH** |
| 4 Stylized / Interpreted | Level 3 optional secondary detail; **must be flagged** | Not default |
| 5 Reimagined | Creative reimagination / stock redesign | Out of scope for Polish |

### Semantic completion budget (engine)

| Level | Name | Default Polish |
|-------|------|----------------|
| 0 Literal | Polish existing geometry only | Always OK |
| 1 Repair | Gaps, broken connections, malformed intersections | May use |
| 2 Recognition Assist | Strongly implied structural details for recognition | May use when confidence warrants |
| 3 Interpretation | Optional secondary details | Not default |
| 4 Reimagination | Unsupported redesign | Out of scope |

**Default may operate at Level 1 or 2** depending on recognition confidence. See principles doc for SEMANTIC COMPLETION vs CREATIVE REIMAGINATION.

### Recognition confidence (internal)

| Band | Stance |
|------|--------|
| HIGH | Semantic completion allowed (≤ Level 2) |
| MEDIUM | Conservative repair / limited completion |
| LOW | Faithful stylization only |

Do **not** lock numeric thresholds here — experimental.

### Default recommendation

1. Run shape + semantic analysis → estimate confidence.  
2. If **HIGH** or solidly **MEDIUM** → spectrum mode **3** (Recognition-Assisted Polish), budget Level 1–2.  
3. If **LOW** → spectrum mode **2** (Faithfully Polished); do not force an object.  
4. Style recipes apply **after** the Transformation Plan; they do not change the semantic reading.

---

## 6. Style families (summary)

Hero styles for this phase (Product_v2 + art-direction sheets):

| Style | One-line intent | Recipe |
|-------|-----------------|--------|
| **Glossy** | Hard candy / polished resin / PVC toy; crisp speculars; mild SSS; no bubbles | [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) → `glossy.v1` |
| **Gummy** | Translucent gelatin; internal bubbles; high gloss; strong rim | → `gummy.v1` |
| **Clay** | Play-Doh / polymer clay; matte; pressed lumps; soft diffuse | → `clay.v1` |
| **Plush** | Short-pile / felt; fiber fringe; soft AO; gloss only on planned feature marks | → `plush.v1` |

Glossy is **first-class**, even if prior lab JSON lacked it.

All numeric recipe parameters are **starting ranges pending lab validation**, not locked finals.

**Critical:** Style recipes **do not own semantics**. They must not invent faces, accessories, or object parts. Completion comes only from the Transformation Plan / semantic layer upstream. Style only styles whatever geometry the plan produces. See [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) §0.3a.

**Lab relationship:** Prior `stylization-lab/recipes/{gummy,clay,plush}*.json` are implementation drafts. Spec documents override conflicting visual assumptions (especially extrusion-as-default and style-owned face invention). Align lab later; **do not modify lab in this documentation pass.**

---

## 7. Engine behavior by doodle type

These rules apply as part of the Transformation Plan (before style recipes). Detail also in [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) §11.

| Doodle type | Required engine behavior |
|-------------|--------------------------|
| Closed shape | Build a dimensional inflated filled volume; Level 1 repair of tiny gaps as needed; lock outer silhouette where practical |
| Open stroke | Soft tube / ribbon with controlled minimum thickness |
| Multiple disconnected strokes | Preserve component graph, spacing, and relative placement; complete connections only when strongly implied (Level 1–2) |
| Overlapping forms | Preserve layering intent; soft merge or AO separation per style |
| Thin features | Preserve intent; apply controlled min thickness; do not erase |
| Face | Preserve existing marks exactly; limited completion only per face rule at HIGH confidence |
| Object-like | Keep object identity; Level 1–2 completion when confidence warrants; forbid character conversion without cues |
| Character-like | Keep user's topology and quirks; limited structural/face completion per confidence; forbid arbitrary anatomy correction |
| Intentionally messy | Keep messy silhouette / proportions; clean stroke noise; complete only recognition-required structure |
| Ambiguous / low confidence | Faithfully Polish only; do not force an object interpretation |

### Color and unfilled regions

- Map doodle color zones 1:1 into style materials (topology preserved).
- Unfilled interior regions (e.g. white snout/belly) → complementary **light fill of the same local material**, not new unrelated parts. Facial marks still follow the face rule.
- Gummy may lift value/saturation for candy readability while keeping hue family.

### Preserve vs complete (Product_v2 + v1.1)

**Always prioritize preserving:** silhouette where practical, proportions, gesture, asymmetry, distinctive shapes, relative placement, color relationships, visible user marks, personality/quirks.

**May complete when strongly implied:** missing structural connections, obvious volume, simple object-defining parts, small recognition-required details, basic form cues clearly suggested.

**Must not add just because they look good:** decorative accessories, arbitrary anatomical corrections, unrelated objects, generic character details, identity-changing stylistic extras, stock/canonical features unsupported by the doodle.

---

## 8. Pipeline / architecture (conceptual)

**Order matters:** geometry and semantic interpretation happen **before** material styling. Style must **not** determine semantic interpretation.

```text
User strokes
    → Canonical doodle representation
    → Shape + semantic analysis
    → Recognition confidence (HIGH / MEDIUM / LOW)
    → Transformation Plan
         (preserve / repair / semantic completion / style intent)
    → Geometry (realization of the plan)
    → Material (style recipe)
    → Lighting
    → Presentation
    → Render (derived, reproducible)
```

Notes:

- Canonical asset = stroke data (+ color / layer metadata as available).
- Renders are derived and must be reproducible from doodle + transform mode + confidence/plan metadata + recipe identity + recorded params.
- Recognition implementation may be future/lab; this pipeline is the **behavioral contract** for when that exists.
- AI is **not** required to ship documentation alignment in this phase (see non-goals).

---

## 9. Evaluation rubric

Score candidate renders for default Polish (modes 2 or 3). Failures on Semantic Recognition (when cues were sufficient), Intent Preservation, or Authorship disqualify regardless of Wow.

| Criterion | Question | Pass bar |
|-----------|----------|----------|
| **Semantic Recognition** | Does the finished result correctly understand what the user was trying to draw? | Correct subject when cues suffice; **fail** if it identifies the category (e.g. rocket) but replaces the user's weird rocket with a store-bought rocket |
| **Intent Preservation** | Does the result retain the user's particular version of the object? | Silhouette/proportions/gesture/asymmetry/marks/quirks still feel like *theirs* |
| **Authorship** | Were completions evidence-backed within budget? | Level ≤2; no creative reimagination; face rule respected |
| **Wow** | Does material + light create delight? | Style-true material read at first glance |
| **Legibility** | Readable at sticker / emoji scale? | Silhouette and marks clear when small |
| **Shareability** | Clean export? | Transparent hero (default), clear silhouette, no noisy baked ground unless requested |
| **Style fidelity** | Matches recipe intent? | Glossy≠gummy≠clay≠plush distinguishable; style did not invent semantics |
| **Spectrum compliance** | Correct mode for confidence? | No silent Level 3–4; LOW confidence did not force object reading |

Suggested review practice: side-by-side source doodle vs render; ask both "what were they trying to draw?" and "is this still *their* version?"; checklist against doodle-type rules and face rule before subjective beauty scoring.

Recognition and authorship **both** matter.

---

## 10. Versioning and reproducibility

1. Spec set version: record `stylization-spec.v1.1` (this document) when evaluating historical renders.  
2. Each render must store at least: doodle id / hash, `style_id`, `style_version`, transform spectrum mode, recognition confidence band (when applicable), completion budget level used, and parameter set (or seed + recipe defaults).  
3. Recipe changes that alter visual signature require a new `style_version`.  
4. Presentation-only derivatives (resolution, padding) must not silently change identity or semantic-plan parameters.  
5. Numeric values in [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) remain **starting ranges** until a later lab validation pass locks them; locked values must be published as an updated recipe version, not silently overwritten.

---

## 11. Non-goals (this phase)

Explicitly out of scope for this specification effort:

- Building or shipping a mobile app UI in this pass
- Building AI / recognition models or running benchmarks in this documentation pass (recognition may be future/lab; this is the behavioral contract)
- Modifying Blender lab files / recipes / stylization-lab as part of writing these docs
- Copying or mandating specific characters / sheet compositions from Doodle-Emoji Recipe.pdf
- Completely reimagined generations, prompt-first sticker makers, or stock canonicalization as default Polish
- Treating hard extrusion walls as the definition of 3D polish
- Letting style recipes own semantic interpretation or auto-cute-face behavior

---

## 12. Document map

| Need | Go to |
|------|-------|
| Recognition-Assisted Polish, spectrum 1–5, budget, confidence, preserve/complete, face rule, examples, safeguards | [`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMATION-PRINCIPLES.md) |
| Per-style geometry/material/lighting/camera/color + comparison; style≠semantics | [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) |
| v1.1 change summary | [`CHANGELOG-v1.1.md`](./CHANGELOG-v1.1.md) |
| Product promise, moat, MVP framing | [`../Product_v2.md`](../Product_v2.md) |
| Art-direction page images (material language only) | `refs/pdf-pages/page-01.png` … `page-10.png` |

---

## 13. Acceptance checklist for implementers

A Polish implementation aligns with this spec when:

- [ ] Default path is Recognition-Assisted Polish when confidence is MEDIUM–HIGH; Faithfully Polished when LOW
- [ ] Spectrum includes all five modes; Level 3–4 are not silent defaults
- [ ] Semantic Completion Budget Levels 0–4 are respected; default uses Level 1–2 only as warranted
- [ ] Pipeline runs semantic/geometry plan **before** material style
- [ ] Style recipes do not invent faces, accessories, or object parts
- [ ] Face rule uses semantic vs style split (principles §9)
- [ ] Dimensional stack prefers inflation / bevel / shading / material / light over extrusion walls
- [ ] Glossy, Gummy, Clay, Plush are all first-class and distinguishable
- [ ] Doodle-type rules allow Level 1–2 completion when confidence warrants; refuse forced reads on blobs
- [ ] Rubric includes Semantic Recognition and Intent Preservation; both can fail independently
- [ ] Params are treated as starting ranges until lab-validated versions lock
- [ ] Renders are reproducible from stroke data + plan metadata + recipe metadata
- [ ] Lab files are not modified in this documentation phase; align later

---

*End of STYLIZATION-SPEC.md — historical v1.1 record (superseded by docs/spec-v1.2/).*
