# Transform Principles — Dooji

**Version:** 1.2 (2026-10-02) — Intent-Preserving Stylized Reconstruction  
**Previous:** 1.1 at [`../spec-v1.1/TRANSFORMATION-PRINCIPLES.md`](../spec-v1.1/TRANSFORMATION-PRINCIPLES.md)  
**Document role:** Art-direction and product rules for how a user doodle becomes a polished Dooji.  
**Status:** Principles companion to the binding contract  
**Canonical source of truth:** [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md)  
**Companions:**
- [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) — engine pipeline, doodle-type behavior, evaluation
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) — material recipes (styles do not own semantics)
- [`CHANGELOG-v1.2.md`](./CHANGELOG-v1.2.md)

### What changed from 1.1 (brief)

v1.1 introduced Recognition-Assisted Polish and evidence-gated Level 1–2 completion while still emphasizing silhouette/geometry preservation. v1.2 makes an intentional product-direction change: **Intent-Preserving Stylized Reconstruction**. The doodle is a rough design sketch. Dooji preserves creative decisions (identity, expression, pose, orientation, distinctive features) and aggressively improves drawing execution. Level 2 reconstruction is normal. Similarity is semantic/expressive/compositional — not stroke-level. See [`CHANGELOG-v1.2.md`](./CHANGELOG-v1.2.md).

---

## 1. Promise and moat

**Product promise (v1.2):**

> Draw something messy. Dooji understands what you meant, cleans it up, and makes it beautiful.

**Supporting idea:**

> Your idea. Our polish.

**Moat hypothesis:** Authorship-preserving intent recognition + aggressive reconstruction/polish + distinctive stylization + delightful reveal.

**Emotional outcome (target):**

> Yes! That's exactly what I was trying to draw — but way better.

**Anti-outcomes (failure):**

> Here is an exact extrusion of my messy strokes that technically preserved everything but doesn't look like the thing.

> Here is a beautiful generic stock object that is no longer mine.

---

## 2. NEW CORE PRINCIPLE: Preserve the decisions, not the mistakes

Dooji preserves the user’s **creative intent** while freely improving **drawing execution**.

| Creative intent (protect) | Drawing execution (improve aggressively) |
|---------------------------|------------------------------------------|
| Subject / object identity | Shaky / jagged contours |
| Expression / emotional read | Uneven line weight |
| Pose / posture | Malformed circles / poor curves |
| Orientation / viewing angle | Accidental gaps, broken joins |
| Major proportions | Messy intersections |
| Distinctive features | Rough perspective / drawing noise |
| Relative placement of meaningful parts | Low-quality execution artifacts |
| Intentional asymmetry / quirks | |
| User-selected color relationships | |

**Conflict rule:** When exact source geometry conflicts with polish, preserve the creative anchor and release the low-level geometry.

> The original contour is a reference, not a prison.

---

## 3. Similarity

Similarity is **semantic, expressive, and compositional** — not pixel or stroke similarity.

Judge primarily by: what it is; how it expresses itself; how it is positioned; what is distinctive; how meaningful parts relate; whether it still feels like the user’s version.

Do **not** judge primarily by: exact stroke paths, contour wobble, tiny bumps, pixel outline, or literal extrusion of every source stroke.

---

## 4. Anchor hierarchy

### Very strong anchors — preserve closely

Subject identity · expression · pose/posture · orientation/viewing angle · major proportions · distinctive features · relative placement of meaningful parts

### Medium anchors — preserve broadly

Overall gesture · broad silhouette · intentional asymmetry · user-selected color relationships

### Low priority — free to change

Exact stroke geometry · shaky contours · line weight · bad circles · jagged edges · malformed intersections · accidental gaps · rough perspective · drawing artifacts · low-quality execution

---

## 5. Intent-Preserving Stylized Reconstruction (default)

Default conceptual sequence:

```text
Doodle → Understand → Identify creative anchors → Reconstruct clean geometry
      → Polish / simplify → Apply style → Dimensional lighting → Transparent sticker
```

Style recipes must **not** interpret semantics. They restyle the reconstructed object — and should be pushed hard once anchors are locked.

---

## 6. Transformation spectrum (retained, reframed)

| # | Mode | Identity budget | Allowed change | Product use |
|---|------|-----------------|----------------|-------------|
| 1 | Faithful | Near-literal | Cleanup of sample noise only | Debug / before |
| 2 | Faithfully Polished | Anchors intact; geometry may clean | Level 0–1 | Valid when confidence is LOW / ambiguous |
| 3 | **Intent-Preserving Reconstruction** | User’s particular version of inferred subject | Level 0–2 (Level 2 normal) | **Default when cues support recognition** |
| 4 | Stylized / Interpreted | Same subject family | Level 3 limited secondary detail | Exceptional / flagged |
| 5 | Reimagined | Theme only | Stock redesign / invention | Out of scope |

Recognition-Assisted Polish (v1.1 name) is subsumed by mode 3 with a stronger reconstruction mandate.

---

## 7. Semantic reconstruction budget

| Level | Name | Scope | Default Dooji |
|-------|------|-------|---------------|
| **0** | Clean | Smooth / polish existing geometry | Always allowed |
| **1** | Repair | Gaps, joins, intersections, structural defects | Normal |
| **2** | Reconstruct | Rebuild strongly implied structure for a coherent, recognizable subject | **Normal / core** |
| **3** | Interpret | Limited secondary details supported by source | Exceptional |
| **4** | Reimagine | Unsupported redesign / stock canonicalization | Out of scope |

Normal Dooji transformation may use **Level 0–2**. Level 2 is not an edge case.

**SEMANTIC RECONSTRUCTION** = changes needed to express the user’s communicated intent cleanly.  
**CREATIVE REIMAGINATION** = unsupported cute/beautiful extras. Forbidden in default Dooji.

Operational test: *Would a reasonable viewer looking only at this doodle already expect this structure for the object to read as the user’s version?* If yes → reconstruction candidate. If no → refuse for default.

---

## 8. Expression, pose, and angle

These are **strong anchors**.

**Expression:** Preserve emotional read, eye relationship, mouth/expression intent, placement. Polish line quality and material. Reconstruct poor facial marks rather than tracing them. Do not casually change happy→neutral, surprised→neutral, angry→happy, etc.

**Face invention:** Clear marks → preserve semantic intent while polishing execution. Limited completion only when subject + partial facial intent are strongly supported. Never auto-cute every non-face doodle. Style recipes never invent faces.

**Pose / orientation:** Preserve stance, posture, lean, facing direction, viewing angle, major gesture. Freely reconstruct underlying geometry.

---

## 9. Quirks vs mess

**Quirky** (intentional character) survives: uneven ear sizes, oversized head, crooked smile, unusual tilt, non-standard proportions.

**Messy** (execution noise) is cleaned: shaky edges, contour bumps, accidental gaps, uneven stroke widths, malformed circles, scribble noise.

> Quirky is intentional character. Messy is execution noise.

---

## 10. Anti-generic guardrails

**Do NOT:** replace with a canonical object; add unsupported accessories/anatomy; randomly anthropomorphize; invent unrelated details; turn the doodle into a stock illustration.

**DO:** smooth, reconstruct, simplify, regularize, close obvious gaps, fix malformed geometry, establish coherent volume, adjust thickness, create polished dimensional forms.

Governing rule:

> Strong semantic similarity + strong visual polish is preferred over literal geometric fidelity.

---

## 11. Worked examples (summary)

Full examples: [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md) §19.

- **Rough cat** (huge head, tiny body, crooked smile): keep cat / proportions / expression / pose; reconstruct contours, legs, joins, volume — do not inflate rough strokes.
- **Rough flower / rocket:** keep distinctive count, asymmetry, angle, major marks; refuse stock redesign.
- **Ambiguous blob:** polish abstractly; do not invent a confident wrong object.

---

## 12. Safeguards checklist

1. Creative anchors > exact geometry  
2. Level 2 reconstruction is allowed and expected when cues support it  
3. Level 3–4 are not silent defaults  
4. LOW / ambiguous confidence → do not force object reading  
5. Style never owns semantics  
6. Eval must not punish substantial geometry change when anchors hold  
7. Eval must punish identity drift, expression/pose loss, and generic replacement  

---

*End of TRANSFORMAT-PRINCIPLES.md — v1.2*
