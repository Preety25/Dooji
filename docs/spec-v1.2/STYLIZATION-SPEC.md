# Stylization Spec — Dooji

**Document role:** Engine visual / behavioral companion for Intent-Preserving Stylized Reconstruction.  
**Status:** Binding art-direction + engine behavior for default Dooji transformation  
**Version:** stylization-spec.v1.2 (2026-10-02)  
**Previous:** 1.1 at [`../spec-v1.1/STYLIZATION-SPEC.md`](../spec-v1.1/STYLIZATION-SPEC.md)  
**Canonical source of truth:** [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md)

**Companion documents:**
- [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) — anchors, budget, expression/pose, anti-generic rules
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) — glossy / gummy / clay / plush (styles do not own semantics)
- [`CHANGELOG-v1.2.md`](./CHANGELOG-v1.2.md)

---

## 1. Purpose

Dooji turns an imperfect user doodle into a polished, style-specific, shareable render.

The doodle is a **rough design sketch**, not finished geometry. The engine must:

1. understand what the user meant;
2. identify creative anchors;
3. reconstruct clean, coherent geometry (Level 0–2);
4. polish / simplify;
5. apply the selected style aggressively;
6. present a transparent dimensional sticker.

This is **not** a tracing tool. Materializing exact rough strokes as 3D is an anti-goal.

Implementations (prompt compiler, providers, postprocess, labs) must align to [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md). This document operationalizes the engine contract.

---

## 2. Emotional outcome and product promise

**Promise (v1.2):**

> Draw something messy. Dooji understands what you meant, cleans it up, and makes it beautiful.

**Target reaction:**

> Yes! That's exactly what I was trying to draw — but way better.

**Anti-outcomes:**

- Exact extrusion / inflation of messy strokes that never becomes the intended object.
- Beautiful generic / stock object that is no longer the user’s version.

Success requires **both** correct intent recognition (when cues suffice) **and** retention of the user’s particular creative decisions — not exact stroke geometry.

---

## 3. Reconstruction with authorship (not replace, not mere trace)

| Do | Do not |
|----|--------|
| Infer subject when visual evidence is sufficient | Force an object reading on ambiguous blobs |
| Clean, repair, and reconstruct geometry (Level 0–2) | Trace wobble / jaggedness / bad joins as identity |
| Preserve identity, expression, pose, orientation, distinctive proportions/features | Replace with a canonical/store-bought version |
| Push style hard after reconstruction | Let style recipes invent faces, accessories, or object parts |
| Preserve intentional quirks and asymmetry | Preserve execution mistakes merely because they appear in the source |
| Reconstruct poorly drawn expressions to keep the emotional read | Casually change happy→neutral / angry→happy / etc. |

**Face rule (summary):** user-drawn face → preserve semantic intent + relationships while polishing execution; limited completion only when cues + subject strongly support it; no character cues / abstract → do not invent. Cute face = semantic decision, not a style recipe decision. Full rule: [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) §8 and transform spec §9.

---

## 4. Dimensional stylization

### 4.1 Shared form language

- Pillowy / inflated / pressurized more than prismatic
- Extremely rounded with heavy fillets
- Soft merges at junctions with AO in crevices
- Stuffed or pressed, not hard-edged extrusions

### 4.2 Dimensional ≠ visible side extrusion

Preferred stack (after semantic reconstruction):

1. Silhouette-aware inflation / bulge (of the **reconstructed** form)
2. Soft bevel / fillet
3. Curved shading response
4. Material SSS / sheen / specular
5. Lighting (key / fill / rim / AO)
6. Subtle camera pitch / yaw if it improves presentation without changing intended read

Hard extrusion walls are last resort — not the definition of polish.

---

## 5. Transformation spectrum and default mode

Full definitions: [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) §§5–7.

```text
1 Faithful
2 Faithfully Polished
3 Intent-Preserving Reconstruction   ← default when cues support recognition
4 Stylized / Interpreted             ← exceptional
5 Reimagined                         ← out of scope
```

### Semantic reconstruction budget (engine)

| Level | Name | Default Dooji |
|-------|------|---------------|
| 0 Clean | Smooth / polish existing geometry | Always OK |
| 1 Repair | Gaps, joins, intersections | Normal |
| 2 Reconstruct | Strongly implied structure for coherent subject | **Normal / core** |
| 3 Interpret | Limited secondary detail | Exceptional |
| 4 Reimagine | Unsupported redesign | Out of scope |

**Default may operate at Level 0–2.** Level 2 is expected product behavior when recognition cues support it.

### Recognition confidence (internal)

| Band | Stance |
|------|--------|
| HIGH | Reconstruction through Level 2 allowed / expected |
| MEDIUM | Reconstruct conservatively but still clean aggressively |
| LOW | Faithful polish of abstract form; do not force an object |

Numeric thresholds remain experimental — do not lock here.

### Default recommendation

1. Understand doodle → estimate confidence.  
2. If **HIGH** or solidly **MEDIUM** → mode **3**, budget Level 0–2.  
3. If **LOW** → mode **2**; do not invent a subject.  
4. Style recipes apply **after** reconstruction; they do not change the semantic reading.

---

## 6. Style families (summary)

| Style | One-line intent | Recipe |
|-------|-----------------|--------|
| **Glossy** | Polished resin / vinyl / hard-candy toy; crisp speculars; opaque | [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) |
| **Gummy** | Juicy translucent gelatin; internal bubbles; wet highlights | → `gummy` |
| **Clay** | Soft matte polymer / Play-Doh; tactile; rounded | → `clay` |
| **Plush** | Stylized stuffed-toy / short pile / felt — **not** photoreal fur | → `plush` |

**Critical:** Style recipes **do not own semantics**. They must not invent faces, accessories, or object parts. Style restyles reconstructed geometry. After anchors are locked, **push style hard**.

---

## 7. Engine behavior by doodle type

| Doodle type | Required engine behavior |
|-------------|--------------------------|
| Closed shape | Reconstruct coherent inflated volume; smooth execution noise; preserve distinctive proportions |
| Open stroke | Soft tube / ribbon; keep gesture/placement; clean jitter/thickness |
| Multiple disconnected strokes | Preserve meaningful component relationships; reconnect only when strongly implied |
| Overlapping forms | Preserve layering intent; reconstruct coherent intersections |
| Thin features | Preserve intent; adjust thickness for legibility; do not erase meaningful marks |
| Face | Preserve emotional intent + relationships; polish execution; limited completion per face rule |
| Object-like | Keep object identity + major features; reconstruct structure; strong dimensionalization |
| Character-like | Keep identity, expression, pose, distinctive topology; clean geometry substantially |
| Intentionally messy | Keep characterful proportions/asymmetry via material & form — not via poor geometry |
| Ambiguous / low confidence | Faithfully polish abstract form; do not force an object |

### Preserve vs improve (v1.2)

**Always prioritize preserving (creative anchors):** subject identity, expression, pose, orientation, major proportions, distinctive features, relative placement, intentional asymmetry, color relationships.

**Aggressively improve (execution):** wobble, jaggedness, bad circles, uneven thickness, accidental gaps, malformed joins, messy intersections, rough perspective, drawing noise.

**Must not add just because they look good:** decorative accessories, arbitrary anatomy, unrelated objects, generic character details, stock/canonical features unsupported by the doodle.

---

## 8. Pipeline / architecture (conceptual)

**Order matters:** understanding and reconstruction happen **before** material styling.

```text
User doodle
    → Understand (subject, expression, pose, orientation, features)
    → Identify creative anchors
    → Reconstruct clean geometry (Level 0–2)
    → Polish / simplify / regularize
    → Material (style recipe)
    → Lighting
    → Presentation (transparent sticker)
    → Render (derived, reproducible)
```

Provider-agnostic boundary remains: mobile never owns credentials or provider choice. This spec changes behavioral intent, not the `/v1/transform` architecture.

---

## 9. Evaluation rubric

Score candidate renders for default Dooji. A render must **not** fail merely because geometry differs substantially from the doodle. A render **should** fail if it changes subject identity, expression, pose, orientation, or major distinctive characteristics — or if it becomes a generic stock object.

| Criterion | Question | Pass bar |
|-----------|----------|----------|
| **Intent recognition** | Does the result understand what the user was trying to draw? | Correct subject when cues suffice |
| **Anchor preservation** | Identity, expression, pose, orientation, major proportions, distinctive features? | Recognizably the user’s version |
| **Reconstruction quality** | Was poor execution cleaned/rebuilt rather than merely materialized? | Coherent polished geometry |
| **Polish** | Substantially more refined than the source? | Clear quality jump |
| **Style fidelity** | Correct distinctive style read? | Gummy≠clay≠plush≠glossy; style did not invent semantics |
| **Authorship** | Feels like their particular version? | Not a generic AI object |
| **Unwanted invention** | Unsupported additions absent? | No stock extras / casual anatomy / faces |
| **Legibility** | Readable at sticker scale? | Clear when small |
| **Shareability / presentation** | Clean transparent export? | No studio box / ground plane |
| **Wow** | Delightful? | “That’s what I meant — and now it looks amazing.” |

**Bias:** Better polished reconstruction is preferable to literal messy geometry.

---

## 10. Versioning and reproducibility

1. Spec set version: record `stylization-spec.v1.2` / transform-spec v1.2 when evaluating renders.  
2. Each render stores at least: doodle id/hash, `style_id`, `style_version`, transform mode, confidence band (when applicable), reconstruction budget level, provider params/seed when applicable.  
3. Recipe changes that alter visual signature require a new `style_version`.  
4. Transformation-policy changes are versioned separately from material recipes.  
5. Presentation-only derivatives must not silently rewrite semantic identity.

---

## 11. Non-goals

- Mobile UX redesign solely for this philosophy
- Changing production provider routing as part of this pass
- Generic text-to-image disconnected from the doodle
- Silent Level 4 reimagination
- Style recipes inventing semantics
- Treating geometric IoU / stroke fidelity as the primary quality gate

---

## 12. Acceptance checklist for implementers

- [ ] Default philosophy is Intent-Preserving Stylized Reconstruction
- [ ] Similarity treated as semantic / expressive / compositional
- [ ] Level 0–2 allowed in normal use; Level 2 is core, not exceptional
- [ ] Expression, pose, orientation are strong anchors
- [ ] Prompt language does not over-constrain exact stroke / silhouette preservation
- [ ] Style applied after reconstruction and pushed hard
- [ ] Anti-generic guardrails intact
- [ ] Rubric rewards reconstruction + polish; does not punish geometry change when anchors hold
- [ ] Provider-agnostic architecture unchanged
- [ ] Transparent sticker presentation default

---

*End of STYLIZATION-SPEC.md — v1.2*
