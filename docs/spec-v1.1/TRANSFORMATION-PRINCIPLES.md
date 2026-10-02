# Transform Principles — Doodle Emoji

> **Superseded for current product behavior by [../spec-v1.2/TRANSFORMAT-PRINCIPLES.md](../spec-v1.2/TRANSFORMAT-PRINCIPLES.md) and the binding [../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md](../spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md). Keep this file as the v1.1 historical record.


**Version:** 1.1 (2026-09-23)  
**Previous:** 1.0 archived at archive/v1.0 (not in repo)  
**Document role:** Art-direction and product rules for how a user doodle becomes a polished render.  
**Status:** Visual source companion (principles layer) — primary home for Recognition-Assisted Polish  
**Canonical companions:**
- [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) — engine visual source of truth, pipeline, evaluation rubric
- [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) — versioned style recipes (glossy / gummy / clay / plush)
**Sources:** Product_v2; Doodle-Emoji Recipe.pdf (art-direction reference only — do not reproduce specific characters or sheet layouts)

### What changed from 1.0 (brief)

v1.0 treated inventing any structure as failure and made Faithfully Polished the only default. v1.1 introduces **Recognition-Assisted Polish** as a first-class product mode: the system may infer the likely subject when visual evidence is sufficient and may **semantically complete** strongly implied structure — without replacing the user's particular version with a generic/canonical object. Creative reimagination remains out of default scope. See [`CHANGELOG-v1.1.md`](./CHANGELOG-v1.1.md).

---

## 1. Promise and moat

**Core promise (Product_v2 — retained):**

> Draw something messy. We will make it look good without making it stop feeling like yours.

**Underlying intent (v1.1):**

> We can help your doodle become the thing you meant to draw.

**Moat hypothesis:** Authorship-preserving recognition + distinctive stylization + delightful reveal.

**Emotional outcome (target):**

> That's what I was trying to draw — and now it looks amazing.

**Anti-outcome (failure):**

> Here is an exact extrusion of my messy strokes that technically preserved everything but doesn't actually look like the thing.

Polish does not replace authorship. Recognition-Assisted Polish may complete when strongly implied; it must never substitute a stock/canonical/generic representation for the user's version.

Think: **"complete MY rocket"** — not **"generate A rocket."**

---

## 2. NEW CORE PRINCIPLE: Recognition-Assisted Polish

The system may **infer the likely subject/object** when there is sufficient visual evidence, and may **selectively complete or repair structure** needed to make that subject recognizable and visually coherent.

**Constraints that never relax:**

- The user's particular version remains the **source of truth**.
- Must **not** replace with a canonical, generic, or stock representation.
- Completion is justified by evidence in the doodle, not by taste, cuteness, or sheet aesthetics.
- Style recipes do **not** decide semantics (see [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) §0.3a and pipeline in [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md)).

**Poor drawers are not punished.** Incomplete or crude drawings with clear subject cues deserve recognition assist. Ambiguous blobs do not.

Recognition-Assisted Polish is a **first-class product mode**, not a failure mode and not a quiet form of reimagination.

---

## 3. Transformation spectrum (v1.1)

Distinguish five modes:

| # | Mode | Identity budget | Allowed change | Product use |
|---|------|-----------------|----------------|-------------|
| 1 | **Faithful** | Near-literal stroke geometry | Cleanup of sample noise only; flat or minimal depth | Debug / before state |
| 2 | **Faithfully Polished** | Silhouette, parts, marks, asymmetry intact | Smooth volumes, material, light, presentation; Level 0–1 completion only | Valid path when recognition confidence is low, or when user opts literal |
| 3 | **Recognition-Assisted Polish** | User's particular version of the inferred subject | Level 1–2 semantic completion when confidence supports it; then material/light/volume | **Default product path when recognition confidence is MEDIUM–HIGH** |
| 4 | **Stylized / Interpreted** | Same subject family; optional secondary detail | Level 3 interpretation; stronger material/volume dialect | Optional / flagged — not default Polish |
| 5 | **Reimagined** | Theme only | New parts, stock redesign, creative reimagination | Out of scope for default Polish |

### Default recommendation (v1.1)

- When recognition confidence is **HIGH** (or solidly **MEDIUM**): default = **Recognition-Assisted Polish** (spectrum mode 3), operating within the **Semantic Completion Budget** at Level 1 or 2.
- When recognition confidence is **LOW**: default = **Faithfully Polished** (spectrum mode 2) — faithful stylization only; no forced object reading.
- Never silently escalate to Stylized/Interpreted (4) or Reimagined (5) as default Polish.

Art-direction examples in Doodle-Emoji Recipe.pdf that invent unsupported secondary detail (e.g. a leaf midrib with no cue) remain **Interpreted** references for material language — not default engine behavior.

---

## 4. Semantic completion vs creative reimagination

| Term | Definition | Allowed in Recognition-Assisted Polish? |
|------|------------|----------------------------------------|
| **SEMANTIC COMPLETION** | Changes or additions **strongly implied** by the drawing and **needed for recognition / coherent structure** of the user's subject | **Yes** (within budget + confidence) |
| **CREATIVE REIMAGINATION** | New details chosen because they are cute, beautiful, or expressive, but **not sufficiently supported** by the source | **No** |

Operational test: *Would a reasonable viewer looking only at the doodle already expect this part to exist for the object to read?* If yes → candidate for semantic completion. If no → creative reimagination; refuse for default Polish.

---

## 5. Semantic Completion Budget

| Level | Name | Scope | Default Polish role |
|-------|------|-------|---------------------|
| **0** | Literal | Only polish existing geometry (smooth, inflate, materialize) | Always allowed |
| **1** | Repair | Broken connections, tiny gaps, malformed intersections that block fill/volume intent | Default may use |
| **2** | Recognition Assist | Infer object; add only **strongly implied** structural details required for recognition | Default may use when confidence warrants |
| **3** | Interpretation | Optional secondary details (decorative veins, optional accessories with weak cues) | Not default; flag if used |
| **4** | Reimagination | Stock redesign, unsupported features, cute extras | Out of scope for default Polish |

**Default may operate at Level 1 or Level 2** depending on recognition confidence. Level 3–4 are never silent defaults.

---

## 6. Recognition confidence (internal engine concept)

Confidence is an **internal planning signal**, not a user-facing UI label in this phase.

| Band | Engine stance |
|------|----------------|
| **HIGH** | Semantic completion (up to Level 2) allowed |
| **MEDIUM** | Conservative repair; limited completion only for the most strongly implied structural needs |
| **LOW** | Faithful stylization only (Level 0–1 repair at most); do not force an object interpretation |

**Do not lock exact numeric thresholds in this specification.** Thresholds are experimental and must be tuned in lab/eval later. Document bands as behavioral contracts, not scores.

When confidence is low, prefer an honest Faithfully Polished result over a wrong object guess.

---

## 7. Preserve vs complete vs must-not-add

### 7.1 ALWAYS PRIORITIZE PRESERVING

Where practical, keep:

- Silhouette (outer contour recognizably the user's)
- Proportions
- Gesture
- Asymmetry
- Distinctive shapes
- Relative placement of parts
- Color relationships / zone topology
- Visible user marks (eyes, windows, pads, scribbles actually drawn)
- Personality and quirks (awkwardness that reads as *theirs*)

### 7.2 MAY COMPLETE WHEN STRONGLY IMPLIED

When confidence and budget allow:

- Missing structural connections (gaps that break an otherwise clear object)
- Obvious volume implied by closed or near-closed regions
- Simple object-defining parts strongly cued by the doodle
- Small details **required for recognition** of the inferred subject
- Basic form cues clearly suggested by stroke groups

### 7.3 MUST NOT ADD JUST BECAUSE THEY LOOK GOOD

Forbidden under default Polish (including Recognition-Assisted):

- Decorative accessories
- Arbitrary anatomical corrections
- Unrelated objects
- Generic character details unsupported by the doodle
- Stylistic details that change object identity
- Stock / canonical features unsupported by the doodle
- Cute extras chosen for sheet aesthetics

### 7.4 Operational authorship checks

1. Could the user point to each major part and say either "I drew that" or "that's what I was trying to draw, and you finished *my* version"?
2. Would removing style lighting still leave a recognizable silhouette of *their* particular object — not a store-bought template?
3. Did we add any mark that is neither present in the source nor strongly implied by recognition at the allowed budget level?

If (2) fails because we swapped in a generic object, we have drifted into Reimagined — fail Recognition-Assisted Polish even if beauty is high.

---

## 8. Worked examples (explicit)

| Doodle cues | Allowed Recognition-Assisted behavior | Not allowed |
|-------------|----------------------------------------|-------------|
| **Plant:** messy stem + leaf-like shapes + pot | Complete coherent plant structure (connect stem, clarify pot/leaf volumes) while preserving leaf count, asymmetry, pot quirks | Invent midribs, flowers, soil texture, or a canonical nursery plant |
| **Rocket:** body + fins + window-like mark | Complete coherent rocket; keep weird proportions, fin placement, window mark | Replace with a stock NASA-style rocket; invent boosters, flames, logos |
| **Teddy:** round head + ears + body + limbs | Complete coherent plush structure; preserve ear asymmetry and limb gesture | Swap in a store-bought teddy; invent a full face if no facial cues (see §9) |
| **Flower:** rough circular center + surrounding petal strokes | Regularize into a readable flower while preserving petal count, asymmetry, proportions | Change petal count; add stock botanical detailing |
| **Rose:** rough spiral + petal-like enclosing strokes | Interpret/complete as rose when confidence is high; preserve spiral and leaf placement cues | Add thorns/veins with no cue; replace with a perfect florist rose |
| **Random ambiguous blob** | Do **not** force an object interpretation; Faithfully Polish only | Guess "character" / "animal" / "food" and invent structure |

---

## 9. Face rule revision (semantic vs style)

### 9.1 What does not change

Style references must **not** auto-make every object a cute character. Cute faces are **not** a style-recipe default.

### 9.2 What changes in v1.1

When **semantic recognition** strongly indicates a character or object whose face is **essential** to the user's intended subject, **limited facial completion MAY be appropriate** when confidence is **HIGH**.

| Case | Behavior |
|------|----------|
| User drew a face | **Preserve exactly** (placement, scale, count); restyle materials only |
| Obvious teddy / animal face with **partial** facial cues | Limited facial completion **MAY** be allowed at **HIGH** confidence only |
| Object with **no** character cues | Do **not** anthropomorphize |
| Abstract doodle | Do **not** invent a face |

**Cute face = semantic decision, not a style recipe decision.**

- Semantic / Transformation Plan layer: may request limited face completion under the rules above.
- Style layer: styles whatever facial geometry the plan produces; **never invents** faces, eyes, mouth, or blush on its own.

Style sheets in Doodle-Emoji Recipe.pdf that show kawaii bead eyes illustrate **material language**, not a mandate to anthropomorphize. Product semantics override sheet temptation.

---

## 10. Dimensional stylization (shared form language)

Shared across Glossy, Clay, Gummy, and Plush (from reverse-engineered art-direction language):

- Pillowy inflation / bulging soft depth more than hard side extrusion
- Extreme roundness / heavy fillets; no sharp corners
- Soft organic merges at junctions with AO in crevices
- Parts feel stuffed or pressurized, not prismatic extrusions

### Critical: dimensional ≠ visible side extrusion

**Do not equate "3D polish" with obvious side walls.** Preferred stack (in order):

1. Silhouette-aware inflation / bulge (after semantic plan)
2. Soft bevel / fillet
3. Curved shading response
4. Material SSS / sheen / specular
5. Lighting (key / fill / rim / AO)
6. Subtle camera pitch / yaw only if the silhouette still reads as the user's particular object

Hard visible extrusion walls are a **last resort / style-specific option**, not the default definition of polish.

---

## 11. Doodle-type rules (completion-aware)

Apply after shape + semantic analysis; respect confidence and budget.

| Doodle type | Default behavior |
|-------------|------------------|
| **Closed shape** | Dimensional inflated form; Level 1 repair of gaps as needed |
| **Open stroke** | Soft tube / ribbon with controlled minimum thickness |
| **Multiple disconnected strokes** | Preserve component relationships; complete connections only when strongly implied |
| **Overlapping forms** | Preserve layering intent; soft merge or AO separation per style |
| **Thin features** | Preserve intent + controlled minimum thickness (do not erase) |
| **Face** | Preserve user marks exactly; limited completion only per §9 |
| **Object-like** | Keep object identity; Level 1–2 completion when confidence warrants; no character conversion without cues |
| **Character-like** | Keep user's character topology and quirks; limited structural/face completion per confidence; no arbitrary anatomy "fix" |
| **Intentionally messy** | Keep messy silhouette / proportions; clean stroke noise; complete only what recognition strongly requires |
| **Ambiguous blob** | No forced interpretation; Faithfully Polish |

Full engine table and pipeline: [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md).

---

## 12. Safeguards against generic AI reimagination

These safeguards keep Recognition-Assisted Polish from becoming stock redesign:

1. **User version = source of truth** — complete *their* object, never a canonical substitute.
2. **Evidence bar** — completion only when strongly implied; creative reimagination forbidden.
3. **Budget ceiling** — default max Level 2; Level 3–4 not silent.
4. **Confidence gate** — LOW → no forced semantics.
5. **Ambiguity refusal** — random blobs stay faithful.
6. **Preserve list first** — silhouette, proportions, gesture, asymmetry, marks, color relationships.
7. **Face split** — style never invents; semantic layer only under §9.
8. **Eval dual keys** — Semantic Recognition **and** Intent Preservation must both pass ([`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) §9).
9. **Pipeline order** — geometry/semantic interpretation **before** material styling.
10. **No style-owned semantics** — recipes style the plan's geometry; they do not decide what the doodle "is."

---

## 13. Canonical asset and reproducibility

- **Canonical asset** = stroke / doodle data (plus color and layer metadata as available).
- **Renders** are derived assets: reproducible from doodle + style_id + style_version + transform mode + recognition/plan metadata + seed/params.
- Changing only presentation (resolution, padding) must not silently rewrite identity or semantic-plan parameters.
- Lab JSON recipes that already exist (gummy / clay / plush) are **implementation drafts**. These stylization-spec documents are the **new visual source of truth**; lab files must later align. Do not treat prior extrusion-heavy lab defaults as the art-direction definition of polish. **Do not modify the Blender lab in this documentation phase.**

---

## 14. Non-goals for this specification phase

- Do not modify the Blender lab / stylization-lab recipes in this documentation pass.
- Do not build or ship an AI recognition model in this pass (recognition may be future/lab; this doc is the **behavioral contract**).
- Do not define mobile app UI or shipping architecture here.
- Do not reproduce or mandate specific characters from Doodle-Emoji Recipe.pdf.
- Do not treat Recognition-Assisted Polish as license for Reimagined stock stickers.

---

## 15. Evaluation quick checks

For any candidate render under default Polish (modes 2 or 3):

| Check | Pass criterion |
|-------|----------------|
| Semantic recognition | Finished result correctly understands what the user was trying to draw (when cues suffice) |
| Intent preservation | Result retains the user's **particular** version — not a generic canonicalization |
| Authorship | Completions are Level ≤2 and evidence-backed; no creative reimagination |
| Wow | Material + light feel intentional and style-true |
| Legibility | Reads at sticker / emoji scale |
| Shareability | Clean transparency (or approved presentation), clear silhouette |

Full rubric: [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) §9.

---

## 16. Document map

| Need | Go to |
|------|-------|
| Pipeline, engine defaults, full rubric, versioning | [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) |
| Material/geometry/lighting recipes; style≠semantics | [`STYLE-RECIPES.md`](./STYLE-RECIPES.md) |
| v1.1 change summary | [`CHANGELOG-v1.1.md`](./CHANGELOG-v1.1.md) |
| Product promise / moat framing | [`../Product_v2.md`](../Product_v2.md) |

---

*End of TRANSFORMATION-PRINCIPLES.md — v1.1*
