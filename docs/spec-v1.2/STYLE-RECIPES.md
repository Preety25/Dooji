# Style Recipes — Dooji

**Document role:** Versioned visual recipes for hero styles.  
**Status:** Art-direction source of truth for style parameters (starting ranges)  
**Version:** 1.2 (2026-10-02)  
**Previous:** 1.1 at [`../spec-v1.1/STYLE-RECIPES.md`](../spec-v1.1/STYLE-RECIPES.md)  
**Canonical companions:**
- [`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md) — binding Intent-Preserving Stylized Reconstruction contract
- [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) — anchors, reconstruction budget, face rule
- [`STYLIZATION-SPEC.md`](./STYLIZATION-SPEC.md) — engine pipeline, rubric
- [`CHANGELOG-v1.2.md`](./CHANGELOG-v1.2.md)
**Sources:** Product_v2; Doodle-Emoji Recipe.pdf (art-direction reference only — material language, not character copying)

### What changed for v1.2 (brief)

Material / geometry / lighting / camera / color / presentation guidance for glossy / gummy / clay / plush is largely **unchanged**. v1.2 restates that **style recipes do not own semantics**, apply **after** Intent-Preserving Reconstruction, and should be **pushed hard** once creative anchors are locked. Style must not preserve rough source geometry merely to look "handmade." Plush remains stylized stuffed-toy — not photoreal fur.

## 0. How to read this document

### 0.1 Conceptual recipe schema

Every style recipe uses this structure:

```text
style_id
style_version
geometry { ... }
material { ... }
lighting { ... }
camera { ... }
presentation { ... }
```

Plus narrative sections: visual intent, preserve / may vary / avoid.

### 0.2 Starting ranges, not locked finals

All numeric parameters below are **STARTING RANGES / VARIABLES pending lab validation**. They are art-direction targets for implementers to tune — not claimed production locks. Do not treat them as final constants.

Where prior Blender lab recipes exist (`gummy.v1`, `clay.v1`, `plush.v1`, plus variants), those JSON files are **implementation drafts**. **This document is the new visual source of truth.** Lab implementation must later align to these recipes; **do not modify lab files as part of writing this spec.**

**Glossy** is a first-class hero style here even if prior lab JSON lacked a glossy recipe.

### 0.3a Style recipes do not own semantics

**Style recipes must not invent faces, accessories, or object parts.**

Any repair or semantic reconstruction comes from the **upstream Intent-Preserving Reconstruction layer** ([`DOOJI-TRANSFORMAT-SPEC.md`](./DOOJI-TRANSFORMAT-SPEC.md), [`TRANSFORMAT-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md)). Style **only styles** whatever reconstructed geometry the plan produces — and should transform that form substantially into the style's material dialect.

| Layer | Owns | Must not |
|-------|------|----------|
| Semantic / reconstruction | Subject inference, anchors, Level 0–2 reconstruction, limited face completion when rules allow | Creative reimagination; stock redesign; preserving execution mistakes as identity |
| Style recipe (this document) | Material, lighting, camera, presentation, aggressive restyling of reconstructed form | Decide what the doodle "is"; invent faces, accessories, or parts not in the plan; leave rough doodle geometry uncorrected "for handmade feel" |

Pipeline order: understand → identify anchors → reconstruct geometry → polish → **material (style)** → lighting → presentation → render.

### 0.3 Shared form language (all styles)

From cross-style reverse engineering of Doodle-Emoji Recipe.pdf art direction:

- Pillowy inflation / bulging soft depth (prefer over hard side extrusion)
- Extreme roundness / heavy fillets; no sharp corners
- Soft organic merges at junctions with AO in crevices
- Parts feel stuffed / pressurized, not prismatic extrusions

Dimensional polish prefers: inflation → bevel → curved shading → material response → lighting → subtle camera. Hard extrusion walls are last resort.

### 0.4 Face / invention override (all styles) — style layer

- **Style layer never invents** eyes, mouth, blush, cheeks, accessories, or object parts.
- User-drawn facial marks present in the plan → preserve placement / scale / count; restyle into style materials (gloss bead, clay pellet, embroidered / bead-like plush feature, etc.).
- If the Transformation Plan includes **limited facial completion** under principles §9 (HIGH confidence + essential character/object face cues), style restyles those planned marks — it does not invent additional ones.
- If the plan includes no face → style must not add one, even if Doodle-Emoji Recipe.pdf sheets show kawaii faces.
- Style sheets with kawaii faces illustrate **materials only**. Cute face = semantic decision, not a recipe default.

Structural invention (midribs, thorns, stock fins, etc.) is likewise forbidden in the style layer. If the plan did not authorize a part via semantic completion, do not add it for beauty.

---

## 1. Comparison table (four hero styles)

| Dimension | Glossy `glossy.v1` | Gummy `gummy.v1` | Clay `clay.v1` | Plush `plush.v1` |
|-----------|--------------------|------------------|---------------|------------------|
| Visual metaphor | Hard candy / polished resin / PVC toy | Translucent gelatin candy | Play-Doh / polymer clay | Short-pile / needle-felt plush |
| Form | Inflated resin body; nubby rounded points | Maximum puff; thick tubes; torus-like rims | Primitive rounded lumps pressed together | Stuffed spheres / ovoids; fiber fringe silhouette |
| Roughness (start) | Very low `0.02–0.08` | Low `0.04–0.12` | High matte `0.65–0.85` | Very high body `0.80–0.95` |
| Specular | Crisp elongated softbox highlights | Sharp wet highlights | Soft / low | Matte body; high-gloss **only** on planned feature marks |
| SSS / transmission | Mild SSS / inner glow; **no bubbles** | High SSS + transmission; **internal air bubbles (signature)** | Soft chalky SSS; no transmission candy look | Soft body SSS; no jelly transmission |
| Lighting | Bright even studio; high-contrast highlights | Multi-point; strong rim / back for translucency | Diffuse soft key; low contrast | Soft top-front diffuse; gentle AO |
| Color | Saturated; preserve hue families | Candy-bright; may lift/brighten (e.g. forest→lime) | Saturated but softened (pastel lean) | Soft vibrant; color zones map 1:1 |
| Presentation default | Transparent PNG; clean silhouette | Transparent PNG hero (refs may show bokeh — not default product) | Transparent preferred; tactile toy read | Transparent preferred; fiber fringe OK |
| Signature avoid (style layer) | Bubbles; heavy fur; inventing faces/parts not in plan | Matte chalk; inventing faces/parts not in plan; opaque plastic that kills translucency | Sharp gloss; fur; metal; inventing midrib-like detail not in plan | Inventing bead eyes not in plan; fur that erases silhouette; gloss on whole body |

---

## 2. Recipe: `glossy.v1`

### 2.1 Visual intent

Hard-candy / polished-resin / PVC-toy look. Inflated smooth volumes, sharp speculars, mild subsurface edge glow. Feels like a collectible vinyl sticker, not jelly and not clay. Art-direction cue from Doodle-Emoji Recipe.pdf 3D Glossy sheet and glossy rose transform example: same petal count / spiral / leaf placement as the user's version; inflated volumes. New thorns or veins appear only if the Transformation Plan authorized them via semantic completion (default: no).

### 2.2 Geometry recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `inflation_amount` | `0.15–0.30` (TBD by lab) | Silhouette-aware bulge preferred over extrusion |
| `bevel_fillet` | `0.08–0.16` | Heavy fillets; no sharp corners |
| `tube_radius_open` | `0.035–0.06` | Open strokes → soft tubes |
| `min_feature_thickness` | `0.02–0.04` | Thin marks preserved, not erased |
| `merge_softness` | medium–high | Soft merges + AO in crevices |
| `extrusion_wall` | `0.0–0.12` last resort | Prefer inflation; avoid obvious side walls |

Conceptual fields: `geometry.inflation_amount`, `geometry.bevel_fillet`, `geometry.tube_radius_open`, `geometry.min_feature_thickness`, `geometry.merge_softness`.

Geometry realization styles the plan; it does not decide subject identity.

### 2.3 Material recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `roughness` | `0.02–0.08` | Very low |
| `specular` / clearcoat | high | Crisp elongated softbox speculars |
| `sss_weight` | `0.10–0.30` | Mild inner glow — **not** full gummy translucency |
| `transmission` | `0.0–0.05` | Essentially opaque resin/PVC |
| `bubbles` | **off** | Signature of gummy only |
| `metallic` | `0` | Toy plastic / resin, not chrome |

### 2.4 Lighting recipe

- Bright, even studio key + soft fill
- Soft contact / AO in crevices
- High-contrast highlights (speculars sell the gloss)
- Rim optional and subtle (less than gummy)

Starting energies/sizes are lab-relative; prioritize highlight readability over dramatic chiaroscuro.

### 2.5 Camera recipe

- Mostly front / slight 3/4
- Object-centered; generous padding (`0.12–0.18` starting)
- Subtle yaw/pitch only if silhouette still reads as the user's particular object

### 2.6 Color recipe

- Saturated; preserve hue families from the doodle
- Soft curvature gradients: light → rich shadow
- Do not remap object into unrelated candy colors unless user chose them

### 2.7 Presentation recipe

- White / transparent clean field
- Clear silhouette
- Soft ground contact shadow OK in reference sheets; **product export prefers transparent PNG without baked ground** unless a recipe variant states otherwise

### 2.8 What must be preserved

Silhouette (where practical), part count from the plan, petal/leaf/limb placement, asymmetry, planned user marks, hue families, personality quirks.

### 2.9 What may vary

Inflation strength within silhouette, specular intensity, mild SSS, camera micro-angle, value lift for readability.

### 2.10 What should be avoided

Internal bubbles; chalky matte; fur; inventing thorns/veins/faces in the style layer; hard prismatic extrusion walls as the primary "3D" read; Level 3–4 detail not authorized by the Transformation Plan.

---

## 3. Recipe: `gummy.v1`

### 3.1 Visual intent

Translucent gelatin candy: maximum puff, thick fills, torus-like rims, high gloss, **internal air bubbles** (signature), strong rim light. Art-direction cue from Doodle-Emoji Recipe.pdf 3D Gummy sheet and gummy plant transform: lime-lifted translucency, thick torus rim, glossy highlights, candy glow.

### 3.2 Geometry recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `inflation_amount` | `0.22–0.40` | Highest puff of the four |
| `bevel_fillet` | `0.10–0.20` | Soft candy edges |
| `tube_radius_open` | `0.04–0.08` | Thick candy tubes |
| `rim_torus_bias` | medium–high | Closed rims read as thick tori when present |
| `min_feature_thickness` | `0.025–0.05` | Preserve thin intent |
| `extrusion_wall` | last resort | Prefer inflation + translucency cues |

### 3.3 Material recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `roughness` | `0.04–0.12` | Wet gloss |
| `transmission` | `0.15–0.45` | Visible jelly |
| `sss_weight` | `0.35–0.70` | Candy SSS |
| `ior` | ~`1.35–1.45` | Slight refraction |
| `bubbles` | **on** (signature) | Sparse internal air bubbles; density TBD by lab |
| `clearcoat` / wet specular | high | Sharp wet highlights |

### 3.4 Lighting recipe

- Multi-point setup
- Strong rim / backlight to sell translucency
- Candy glow; centers can read brighter than edges (thickness darkens edges)

### 3.5 Camera recipe

- Front / slight 3/4
- Padding `0.12–0.18` starting
- Reference sheets may show soft bokeh BG; **product default remains transparent hero** unless a presentation variant says otherwise

### 3.6 Color recipe

- Candy-bright
- May brighten / lift source (e.g. forest green → lime) while keeping hue family recognizable
- Thickness darkens edges; centers glow

### 3.7 Presentation recipe

Delicious candy object; silhouette may soften from glow but must stay readable; transparent PNG preferred for stickers.

### 3.8 What must be preserved

Silhouette, component relationships from the plan, planned user marks, object identity (user's particular version), color-zone topology (even if values lift).

### 3.9 What may vary

Bubble density, transmission vs SSS balance, rim energy, candy value lift amount.

### 3.10 What should be avoided

Fully opaque plastic that kills jelly; matte chalk clay look; inventing faces/parts in the style layer; over-glow that destroys silhouette; treating bubbles as optional "noise" that vanishes — bubbles are signature when the style is chosen.

### Lab relationship note

Prior lab `gummy.v1.json` / `gummy_sugar.v1.json` explored roughness, clearcoat, transmission, and sugar-crust bump. Align future lab work to this art-direction recipe (especially **bubbles** and inflation-over-extrusion). Do not edit lab files in this pass.

---

## 4. Recipe: `clay.v1`

### 4.1 Visual intent

Play-Doh / polymer-clay: matte, hand-pressed parts, primitive rounded lumps stuck together, soft diffuse light. Secondary bits feel "stuck on," not fused into one plastic mold. Art-direction cue from Doodle-Emoji Recipe.pdf 3D Clay sheet and clay plant transform: matte plump pot + rim + leaves. **Note:** the clay plant example subtly adds a leaf midrib — that is **Level 3 Interpretation** unless the doodle strongly implies it. Product default must not invent such detail in the style layer; only a flagged Interpreted plan may authorize it.

### 4.2 Geometry recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `inflation_amount` | `0.15–0.32` | Plump lumps |
| `bevel_fillet` | `0.10–0.18` | Soft pressed edges |
| `part_separation` | slight | Secondary bits read as stuck-on |
| `micro_imperfection` | low–medium | Soft surface irregularity, not damage |
| `tube_radius_open` | `0.04–0.07` | Rolled clay snakes for open strokes |
| `extrusion_wall` | last resort | Prefer pressed volumes |

### 4.3 Material recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `roughness` | `0.65–0.85` | Matte / chalky |
| `specular` | `0.05–0.20` | No sharp gloss |
| `sss_weight` | `0.35–0.65` | Soft clay SSS |
| `transmission` | `0` | Opaque clay |
| `bump_micro` | `0.01–0.03` | Soft micro-imperfections |
| `fur` / `metal` | **off** | Never |

### 4.4 Lighting recipe

- Diffuse soft key
- Gentle broad shadows
- Low contrast relative to glossy/gummy
- Soft AO at junctions between pressed parts

### 4.5 Camera recipe

- Front-ish; toy-table framing
- Padding `0.14–0.18` starting
- Minimal dramatic angle

### 4.6 Color recipe

- Saturated but softened (pastel lean)
- Flatter than gummy; less internal glow
- Preserve hue families; avoid candy lift that reads as jelly

### 4.7 Presentation recipe

Tactile toy on light ground in references; product prefers transparent PNG with soft silhouette that remains clear.

### 4.8 What must be preserved

Silhouette, pressed-part count from the plan, spacing, asymmetry, planned user marks; no style-invented midribs / veins / facial features.

### 4.9 What may vary

Lump plumpness, micro-imperfection amplitude, pastel softening amount, AO strength.

### 4.10 What should be avoided

Sharp gloss; fur; metal; inventing secondary sculpted detail in the style layer (midribs, fingerprints as brand mark, smiles); unmarked Level 3–4 detail; prismatic extrusion as primary read.

### Lab relationship note

Prior lab `clay.v1.json` / `clay_claymorph.v1.json` used extrusion + remesh + matte SSS. Future alignment should emphasize pressed lumps + inflation and treat prior extrusion values as provisional, not art-direction gospel.

---

## 5. Recipe: `plush.v1`

### 5.1 Visual intent

Short-pile / needle-felt plush: stuffed spheres and ovoids, extreme soft edges, fiber fringe on silhouette, soft AO at joints. Art-direction cue from Doodle-Emoji Recipe.pdf 3D Plush sheet and plush teddy transform: fur texture replaces crayon scribble; color zones map 1:1 (including pads / cheeks / inner ears when drawn or planned); facial marks — when present in the plan — preserved as bead / embroidery-like; white unfilled snout/belly → complementary light plush fill of the **same local material**, not style-invented features.

If the Transformation Plan authorizes limited facial completion for a HIGH-confidence teddy/animal with partial cues ([`TRANSFORMATION-PRINCIPLES.md`](./TRANSFORMAT-PRINCIPLES.md) §9), plush restyles those planned marks. The plush recipe itself never invents a face.

### 5.2 Geometry recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `inflation_amount` | `0.20–0.38` | Stuffed feel |
| `bevel_fillet` | `0.12–0.22` | Extreme soft edges |
| `fiber_silhouette_fringe` | low–medium | Fibers catch silhouette |
| `tube_radius_open` | `0.05–0.08` | Soft stuffed cords |
| `joint_ao` | medium | Soft AO at joints |
| `extrusion_wall` | last resort | Prefer stuffed inflation |

### 5.3 Material recipe (STARTING RANGES)

| Parameter | Starting range | Notes |
|-----------|----------------|-------|
| `body_roughness` | `0.80–0.95` | Matte plush body |
| `fuzz_sheen` | medium–high | Short-pile sheen + bump or short hair approx |
| `fuzz_bump_freq` | high | High-frequency short fuzz / felt |
| `sss_weight` | `0.40–0.75` | Soft body |
| `feature_gloss` | high **only on planned** eyes/windows/etc. | Never invent in style layer; restyle planned marks only |
| `transmission` | `0` | Not jelly |

### 5.4 Lighting recipe

- Soft top-front diffuse
- Gentle self-shadow
- Soft AO at joints
- Avoid harsh speculars on body pile

### 5.5 Camera recipe

- Front; cozy toy framing
- Padding `0.14–0.20` starting
- Minimal yaw/pitch

### 5.6 Color recipe

- Soft vibrant
- Map doodle color zones **1:1**
- Unfilled interior regions → complementary **light fill of the same local plush material**, not new parts invented by style

### 5.7 Presentation recipe

Tactile plush; fiber fringe on silhouette acceptable; transparent preferred for stickers.

### 5.8 What must be preserved

Color-zone map, facial mark placement when present in the plan, silhouette quirks, part relationships, asymmetry, user's particular teddy/character proportions.

### 5.9 What may vary

Fuzz frequency / sheen, pile length approximation, fill value for unfilled interiors (light complementary only), AO softness.

### 5.10 What should be avoided

Inventing bead eyes / mouths / blush in the style layer; glossing the entire body like PVC; jelly bubbles; "fixing" anatomy for beauty; replacing silhouette with a store-bought teddy template; Level 3–4 accessories not in the plan.

### Lab relationship note

Prior lab `plush.v1.json` / `plush_fiber.v1.json` used sheen + fine bump approximations under EEVEE. Align future work to fiber-fringe silhouette + style-layer non-invention of faces; treat particle hair as optional offline enhancement later, not a requirement of this recipe version.

---

## 6. Shared presentation defaults (product)

Unless a variant recipe overrides:

| Setting | Default |
|---------|---------|
| Background | Transparent (film transparent / alpha PNG) |
| Baked ground shadow | Off for hero export |
| Framing | Object-centered with generous padding |
| Resolution | Messaging-friendly derivatives derived from hero (exact sizes product-defined elsewhere) |
| Style metadata | Persist `style_id` + `style_version` with render |
| Plan metadata | Persist transform mode, confidence band, completion level when applicable |

---

## 7. Recipe versioning rules

1. Changing visual intent or material signature → bump `style_version` (e.g. `gummy.v2`).
2. Tuning within starting ranges for lab calibration → may remain `.v1` until locked, but record param deltas in lab notes (outside this doc).
3. Derived variants (sugar crust, fiber, claymorph) should use distinct `style_id`s and declare a parent when applicable.
4. Renders must record the recipe identity used so results are reproducible from stroke data + plan metadata + recipe version.
5. Semantic-policy changes live in TRANSFORMATION-PRINCIPLES / STYLIZATION-SPEC; do not encode subject invention inside recipe versions.

---

## 8. Relationship to prior lab recipes

| Lab file (do not modify here) | Spec recipe | Guidance |
|-------------------------------|-------------|----------|
| `stylization-lab/recipes/gummy.v1.json` | `gummy.v1` | Align later: bubbles, inflation-over-extrusion, rim for translucency |
| `stylization-lab/recipes/gummy_sugar.v1.json` | optional variant | Keep as experimental sugar dialect; not the hero default |
| `stylization-lab/recipes/clay.v1.json` | `clay.v1` | Align later: pressed lumps, matte chalk, no style-invented detail |
| `stylization-lab/recipes/clay_claymorph.v1.json` | optional variant | Pillowy claymorph dialect |
| `stylization-lab/recipes/plush.v1.json` | `plush.v1` | Align later: fuzz/sheen, style≠semantics face rules, 1:1 color zones |
| `stylization-lab/recipes/plush_fiber.v1.json` | optional variant | Fiber approximation dialect |
| *(none yet)* | `glossy.v1` | First-class hero; implement later without inventing sheet characters |

**These stylization-spec documents override conflicting visual assumptions in prior lab recipes.** Implementation work happens in a later pass. **Do not modify the Blender lab / stylization-lab recipes in this documentation phase.**

---

*End of STYLE-RECIPES.md — v1.1*
