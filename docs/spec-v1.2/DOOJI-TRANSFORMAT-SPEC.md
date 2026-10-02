# Dooji Transformation Spec

**Document role:** Product + visual source of truth for how a user's doodle becomes a polished, stylized Dooji.

**Version:** 1.2 — Intent-Preserving Stylized Reconstruction

**Previous:** 1.1 — Recognition-Assisted Polish

**Status:** Binding transformation contract for the Dooji MVP transformation engine.

**Canonical companions:**
- `STYLE-RECIPES.md` — material/style-specific geometry, lighting, camera, color, and presentation rules.
- Product transformation implementation — prompt compiler, provider adapters, post-processing, and evaluation harness.

---

## 1. Purpose

Dooji turns an imperfect user doodle into a polished, dimensional, style-specific, shareable render.

The system is not a tracing tool. A doodle is a **rough design sketch** that communicates an idea. The transformation engine should understand that idea, reconstruct it cleanly, and then stylize it strongly.

The central product challenge is to improve drawing execution **without taking creative ownership away from the user**.

This specification defines:

- the transformation promise and product intent;
- what similarity means for Dooji;
- which creative decisions must remain anchored to the doodle;
- which drawing imperfections the engine should freely improve;
- when semantic reconstruction is allowed;
- how expression, pose, angle, and distinctive quirks are handled;
- how material styles are applied after reconstruction;
- safeguards against generic AI reimagination;
- evaluation criteria for provider and prompt experiments;
- reproducibility and implementation expectations.

---

## 2. Product promise

> **Draw something messy. Dooji understands what you meant, cleans it up, and makes it beautiful.**

Supporting product idea:

> **Your idea. Our polish.**

Target emotional reaction:

> **“Yes! That's exactly what I was trying to draw — but way better.”**

Dooji should be particularly valuable to people who have strong visual ideas but do not consider themselves good at drawing.

The system should make poor drawing execution less limiting without making the final result feel generic or disconnected from the user's original idea.

---

## 3. Core transformation principle

### Preserve the decisions, not the mistakes.

Dooji should preserve the user's **creative intent** while freely improving **drawing execution**.

This creates two different classes of information in the source doodle.

### 3.1 Creative intent — protect

These are meaningful decisions the user made, or strongly communicated:

- **Subject / object identity** — what the user intended to draw.
- **Expression** — emotional or facial intent when present.
- **Pose / posture** — sitting, leaning, curled, reaching, standing, etc.
- **Orientation / viewing angle** — facing left/right/front/side and implied tilt.
- **Major proportions** — oversized head, tiny body, long ears, large petals, etc.
- **Distinctive features** — unusual ears, tail shape, window, leaf arrangement, eye relationship, and similar identity cues.
- **Relative placement of meaningful parts** — where important components sit in relation to each other.
- **Broad gesture / composition** — the overall action, flow, and spatial arrangement.
- **Intentional asymmetry or quirks** — unusual characteristics that read as part of this particular user's version.
- **User-selected color relationships** when they communicate identity or intent.

### 3.2 Drawing execution — improve aggressively

These are normally not creative decisions and should not be preserved merely because they appear in the doodle:

- shaky strokes;
- jagged contours;
- uneven line weight;
- malformed circles;
- poor curves;
- accidental gaps;
- broken connections;
- awkward joins;
- messy intersections;
- minor perspective mistakes;
- accidental overlaps;
- inconsistent thickness;
- noisy scribbles that do not contribute to intent;
- rough geometry caused by drawing difficulty.

**The engine is explicitly allowed to replace poor execution with cleaner geometry.**

---

## 4. Similarity is semantic, expressive, and compositional — not geometric

Dooji should not optimize for pixel similarity, stroke similarity, or exact contour matching.

A result can be substantially different in low-level geometry and still be highly faithful to the user's idea.

### Similarity should be judged primarily by:

1. **What it is** — subject identity.
2. **How it is expressing itself** — expression and emotional read.
3. **How it is positioned** — pose, posture, orientation, and gesture.
4. **What is distinctive about it** — unusual proportions and recognizable features.
5. **How the meaningful parts relate** — relative placement and composition.
6. **Whether it still feels like the user's version** rather than a generic canonical example.

### Similarity should not be judged primarily by:

- exact stroke paths;
- exact line curvature;
- number of tiny contour bumps;
- original wobble;
- exact pixel outline;
- literal extrusion of every source stroke.

> **The original contour is a reference, not a prison.**

---

## 5. Anchor hierarchy

The engine should conceptually separate **strong anchors** from **reconstruction freedom**.

### 5.1 Very strong anchors

Preserve closely unless there is strong evidence that the source was ambiguous:

- subject identity;
- expression;
- pose / posture;
- orientation / viewing angle;
- major distinctive features;
- major proportions.

### 5.2 Strong but flexible anchors

Preserve broadly while allowing visual cleanup and reconstruction:

- overall gesture;
- broad silhouette;
- relative placement of meaningful components;
- intentional asymmetry;
- color relationships.

### 5.3 Low-priority source details

The engine may substantially change these when doing so improves quality:

- exact contours;
- stroke width;
- exact joins;
- tiny geometry;
- local irregularities;
- drawing noise;
- low-confidence marks with no clear semantic role.

### 5.4 Conflict rule

When exact source geometry conflicts with polish:

> **Preserve the creative anchor and release the low-level geometry.**

Example:

A user draws a cat with a very rough circular head, tiny body, large ears, and a crooked smile.

Dooji should preserve:

- cat identity;
- oversized-head / tiny-body relationship;
- ear relationship;
- expression;
- orientation / pose.

Dooji should freely improve:

- the circular head contour;
- rough legs;
- malformed joins;
- inconsistent line thickness;
- dimensional form.

The target is **their cat, professionally reconstructed**, not an inflated copy of their rough lines.

---

## 6. Intent-Preserving Stylized Reconstruction

This is the default transformation philosophy for Dooji.

The conceptual sequence is:

```text
USER DOODLE
    ↓
UNDERSTAND
    ↓
IDENTIFY CREATIVE ANCHORS
    ↓
RECONSTRUCT CLEAN FORM
    ↓
POLISH / SIMPLIFY / REGULARIZE
    ↓
APPLY MATERIAL STYLE
    ↓
DIMENSIONAL LIGHT + PRESENTATION
    ↓
DOOJI
```

### 6.1 Understand

Interpret the doodle as a rough visual description.

Determine, where evidence supports it:

- likely subject;
- major components;
- expression;
- pose;
- orientation;
- distinctive features;
- meaningful color regions;
- broad composition.

### 6.2 Identify anchors

Separate the information that should remain recognizable from the information that can be freely reconstructed.

### 6.3 Reconstruct

Create clean, coherent geometry that expresses the inferred intent.

The engine may:

- merge strokes into coherent forms;
- smooth contours;
- replace rough circles with clean rounded shapes;
- repair broken connections;
- close obvious gaps;
- rebuild malformed appendages;
- establish clearer head/body relationships;
- create coherent volume;
- adjust feature thickness for legibility;
- simplify accidental marks.

### 6.4 Polish

The system should aim for the **maximum useful polish that does not cause semantic drift**.

The limiting factor is **loss of user intent**, not the amount of visual transformation.

### 6.5 Stylize

Once the form is semantically understood and structurally coherent, apply the selected style strongly.

---

## 7. Semantic reconstruction budget

The old model of “completion” is expanded into a reconstruction spectrum.

| Level | Name | Allowed behavior |
|---|---|---|
| **0** | Clean | Smooth and polish existing geometry. |
| **1** | Repair | Fix obvious gaps, joins, intersections, and structural defects. |
| **2** | Reconstruct | Rebuild strongly implied structure needed to make the intended subject coherent and recognizable. **Normal Dooji behavior.** |
| **3** | Interpret | Add limited secondary details that improve the read when supported by the source. Exceptional / controlled. |
| **4** | Reimagine | Unsupported redesign, stock canonicalization, or creative invention. **Out of scope for default Dooji transformation.** |

### Default

Dooji may operate anywhere from **Level 0 through Level 2** during normal transformation.

Level 3 should be exceptional and explicitly controlled by the transformation system.

Level 4 is not normal Dooji behavior.

The important shift from the previous specification is that **Level 2 reconstruction is not treated as an edge case**. It is a core part of the product promise.

---

## 8. Evidence rule for reconstruction

Reconstruction should be driven by what the doodle communicates, not by generic assumptions about what the object “usually” looks like.

Operational question:

> **What would a reasonable viewer looking only at this doodle infer the user was trying to communicate?**

If a structure is strongly suggested or necessary to make the already-apparent subject coherent, it may be reconstructed.

If it is unsupported and exists only because it would look cute, beautiful, realistic, or stylistically expected, it should not be added by default.

### Good reconstruction

A rough rocket has a body, two side fins, and a window-like mark. Reconstruct the rocket cleanly while retaining the unusual body proportions, fin placement, window, and orientation.

### Bad reimagination

Replace the user's rocket with a polished stock rocket containing boosters, flames, logos, and conventional proportions.

---

## 9. Expression is a strong anchor

Expression communicates intent and should survive poor drawing execution.

If the user attempts a happy, sleepy, surprised, silly, or similar expression, the engine should reconstruct a cleaner version of that expression rather than preserving malformed facial marks.

### Preserve

- emotional read;
- eye relationship;
- mouth / expression intent;
- meaningful placement;
- distinctive facial quirks.

### Improve

- line quality;
- contour smoothness;
- thickness;
- shape regularity;
- material treatment.

### Do not casually transform

- happy → neutral;
- surprised → neutral;
- angry → happy;
- sleepy → excited;
- or otherwise replace the user's intended expression merely because another expression looks more aesthetically pleasing.

### Face invention

- If facial marks are clearly drawn, preserve their semantic intent and relationship while polishing their execution.
- Limited facial completion may be used when the subject and partial facial intent are strongly supported.
- Do not make every non-face doodle into a cute character.
- Style recipes must never independently invent faces.

---

## 10. Pose and orientation are strong anchors

The engine should preserve the user's implied:

- stance;
- posture;
- lean;
- facing direction;
- viewing angle;
- major gesture;
- relationship between body parts.

It may nevertheless reconstruct the underlying geometry substantially.

A badly drawn dog leaning left should remain a **left-leaning dog**, even if the torso, head, legs, and joins are rebuilt.

---

## 11. Distinctive quirks should survive; mess should not

Quirks can communicate authorship.

Examples:

- one ear larger than the other;
- unusually large eyes;
- tiny body with oversized head;
- crooked smile;
- unusually long tail;
- asymmetrical flower petals;
- unusual tilt;
- non-standard but recognizable proportions.

These should generally survive reconstruction.

By contrast:

- shaky edges;
- random contour bumps;
- accidental gaps;
- uneven stroke widths;
- malformed circles;
- scribble noise;

should generally be cleaned away.

> **Quirky is intentional character. Messy is execution noise.**

The engine should preserve the former and improve the latter.

---

## 12. Dimensional stylization

Across all four hero styles, dimensional polish should prioritize soft, convincing form over obvious extrusion.

Shared principles:

- pillowy inflation / bulging soft depth;
- strong roundness and fillets;
- soft organic merges;
- coherent volume;
- convincing material response;
- intentional lighting;
- clean sticker presentation.

Preferred stack:

1. semantic reconstruction;
2. silhouette-aware inflation / bulge;
3. bevel / fillet;
4. curved shading;
5. material response;
6. key / fill / rim / ambient occlusion as appropriate;
7. subtle camera adjustment when it improves presentation without changing the intended read.

Hard visible extrusion walls are **not** the definition of 3D polish and should remain a secondary technique.

---

## 13. Style comes after semantic reconstruction

Style recipes describe **how the reconstructed object becomes beautiful**.

They do not decide **what the object is**.

### Gummy

Aim for:

- juicy inflated volume;
- translucent gelatin;
- strong internal light response;
- rounded forms;
- wet highlights;
- soft luminous edges;
- premium stylized 3D candy-object language.

Avoid:

- photoreal food photography;
- flat plastic;
- generic glossy 3D.

### Clay

Aim for:

- soft sculpted polymer / Play-Doh-like form;
- matte tactile surface;
- rounded volumes;
- subtle handmade character in the material;
- soft diffuse lighting.

Avoid:

- ceramic realism;
- glossy plastic;
- leaving rough source geometry uncorrected merely to appear handmade.

### Plush

Aim for:

- stylized stuffed-toy construction;
- puffy compressed forms;
- short controlled pile / felt appearance;
- soft seams only when structurally natural;
- toy-like proportions and presentation;
- clear readable silhouette.

Avoid:

- photoreal animal fur;
- hyper-detailed hair / fiber photography;
- fuzzy texture replacing clean form;
- white studio backdrops or rectangular image plates;
- thick decorative outlines unless specifically required by presentation.

### Glossy

Aim for:

- polished resin / vinyl / hard-candy toy language;
- clean rounded volume;
- rich opaque color;
- crisp but controlled highlights;
- premium toy-like dimensionality.

Avoid:

- glass-like transparency;
- wire-sculpture appearance;
- pearl / iridescent soap aesthetics;
- generic CGI product renders.

---

## 14. Transparent sticker presentation

The final result should read as a polished sticker / emoji asset:

- transparent background by default;
- no rectangular white / cream backdrop;
- no ground plane;
- no unnecessary scene;
- no baked environment unless deliberately part of the style;
- clean alpha edges;
- object centered and framed appropriately;
- camera adapted to the reconstructed object.

Background removal is presentation processing, not semantic interpretation.

---

## 15. Doodle-type behavior

### Closed shape

- Repair small gaps when necessary.
- Reconstruct coherent inflated volume.
- Smooth contours aggressively where wobble is clearly execution noise.
- Preserve distinctive proportions and silhouette character where meaningful.

### Open stroke

- Interpret as a soft tube / ribbon / line form when appropriate.
- Maintain the stroke's gesture and placement.
- Clean jitter and irregular thickness.

### Multiple disconnected strokes

- Preserve meaningful component relationships.
- Reconstruct connections when the relationship is strongly implied.
- Do not assume every disconnected stroke is an independent object.

### Overlapping forms

- Preserve intended layering where clear.
- Reconstruct coherent intersections and merges.
- Use material / AO / depth to communicate separation where appropriate.

### Thin features

- Preserve their intent.
- Adjust thickness for readability and style.
- Do not erase a meaningful feature simply because the source stroke is thin.

### Character-like doodles

- Preserve character identity, expression, pose, and distinctive topology.
- Clean geometry substantially.
- Complete only what is strongly implied.
- Do not replace the character with a generic mascot.

### Object-like doodles

- Preserve object identity and major features.
- Reconstruct structural form where needed.
- Allow substantial cleanup and dimensionalization.

### Intentionally messy doodles

A deliberately rough aesthetic can remain visible through **characterful proportions, asymmetry, color, and material**, without preserving objectively poor geometry.

### Ambiguous blobs

When evidence is insufficient, do not force a confident object interpretation.

Prefer a polished abstract result over an incorrect semantic invention.

---

## 16. Anti-generic guardrails

Intent-preserving reconstruction must not become stock image generation.

### Never casually replace

- the user's subject;
- the user's expression;
- the user's pose;
- the user's orientation;
- major distinctive proportions;
- distinctive features.

### Never add merely because it looks better

- arbitrary accessories;
- decorative anatomy;
- unrelated objects;
- unsupported facial features;
- generic character conventions;
- stock details;
- logos / symbols / text not present in the source;
- style-specific semantic features that change identity.

### Allowed

- smoothing;
- regularization;
- reconstruction;
- simplification;
- volume creation;
- thickness adjustment;
- clean joins;
- dimensional lighting;
- material transformation;
- camera refinement;
- background / alpha cleanup.

The governing rule is:

> **Strong semantic similarity + strong visual polish is preferred over literal geometric fidelity.**

---

## 17. Provider prompt contract

Any image provider used by Dooji must receive the same core transformation philosophy.

Provider prompts should communicate that:

1. the input is a rough design sketch;
2. semantic understanding happens before styling;
3. creative anchors must be preserved;
4. drawing execution may be substantially reconstructed;
5. rough stroke artifacts should be cleaned rather than reproduced;
6. style should be applied strongly after reconstruction;
7. unsupported semantic invention is prohibited;
8. the final asset should read as a polished transparent sticker.

### Canonical transformation language

> Treat the user's doodle as a rough design sketch, not finished geometry. First understand the intended subject and identify the user's creative anchors: subject identity, expression, pose, orientation, major proportions, distinctive features, and meaningful component relationships. Reconstruct the object cleanly and coherently. Smooth rough contours, repair malformed joins, close obvious gaps, simplify accidental marks, and replace poor drawing execution with polished geometry. Do not reproduce wobble, jaggedness, malformed circles, broken joins, or other drawing imperfections merely because they appear in the source.
>
> Preserve the user's intended expression, pose, angle, major proportions, and distinctive characteristics. Similarity is semantic, expressive, and compositional — not pixel- or stroke-level. The result may differ substantially in low-level geometry when that improves polish.
>
> After reconstruction, transform the result strongly into the requested Dooji style. Make the material, volume, lighting, and dimensional treatment visually intentional and premium. Do not replace the user's version with a generic canonical object, and do not add unsupported accessories, anatomy, facial features, or decorative details.

This language is the behavioral baseline. Individual providers may need implementation-specific wording, but they must not revert to strict stroke-tracing as the default.

---

## 18. Evaluation rubric

Provider and prompt experiments should be judged using the following criteria.

| Criterion | Pass condition |
|---|---|
| **Intent recognition** | The result correctly understands what the user was trying to draw when cues are sufficient. |
| **Anchor preservation** | Subject, expression, pose, orientation, major proportions, and distinctive features remain recognizable. |
| **Reconstruction quality** | Rough drawing execution is meaningfully cleaned and rebuilt rather than merely materialized. |
| **Polish** | Result is substantially more coherent and visually refined than the source doodle. |
| **Style fidelity** | Gummy / Clay / Plush / Glossy each read clearly and distinctly. |
| **Authorship** | The result feels like the user's particular version, not a generic AI object. |
| **Unwanted invention** | Unsupported semantic additions are absent or appropriately constrained. |
| **Legibility** | Result reads clearly at sticker / emoji scale. |
| **Presentation** | Transparent, cleanly framed, and shareable. |
| **Wow** | Plausible user reaction: “That's what I was trying to draw — and now it looks amazing.” |

### Important evaluation change

A render must **not** fail merely because its geometry differs substantially from the original doodle.

A render **should** fail when it changes a meaningful creative anchor or produces a generic replacement.

The benchmark should therefore evaluate **semantic / expressive similarity and reconstruction quality together**, rather than treating geometric fidelity as the primary measure.

---

## 19. Canonical examples

### Rough cat

Source communicates:

- cat;
- oversized head;
- tiny body;
- slightly tilted posture;
- one ear larger;
- crossed or playful expression.

Desired result:

A beautifully reconstructed cat that retains these characteristics while replacing the rough linework with coherent geometry.

Undesired result:

A literal fuzzy inflation of the original strokes, or a generic polished cat with conventional proportions.

### Rough flower

Source communicates:

- circular center;
- approximately six petals;
- one petal larger than the others;
- slightly tilted composition.

Desired result:

A clean flower preserving the petal count, distinctive asymmetry, and tilt, with polished dimensional style.

Undesired result:

A perfect stock flower with a different number of petals and conventional symmetry.

### Rough rocket

Source communicates:

- tall body;
- two side fins;
- window;
- unusual angle.

Desired result:

A polished rocket that keeps the unusual angle, proportions, fin relationship, and window.

Undesired result:

A canonical space rocket with boosters, flames, logos, and redesigned proportions.

### Ambiguous blob

Source does not provide enough evidence for a clear object.

Desired result:

A polished abstract stylized form.

Undesired result:

A confidently invented animal / food / character that the user did not actually communicate.

---

## 20. Transformation decision model

The conceptual decision process is:

```text
1. What is the user probably trying to draw?
                 ↓
2. What creative decisions are clearly communicated?
                 ↓
3. Which source marks are execution artifacts?
                 ↓
4. Reconstruct the intended object cleanly.
                 ↓
5. Preserve strong anchors while allowing geometry to change.
                 ↓
6. Apply the selected material style strongly.
                 ↓
7. Check for semantic drift / unwanted invention.
                 ↓
8. Produce a clean shareable Dooji.
```

The engine should **optimize for the best polished interpretation that remains recognizably theirs**.

---

## 21. Reproducibility and asset identity

The canonical asset remains the user's doodle / stroke data.

Renders are derived assets and should remain reproducible from:

- doodle data / source hash;
- style ID;
- style version;
- transformation mode / plan metadata;
- recognition metadata when available;
- seed / provider parameters when applicable.

Changes to presentation alone should not silently rewrite semantic identity.

Style recipe changes that alter visual signature should receive a new style version.

Transformation-policy changes should be versioned separately from material recipes.

---

## 22. Implementation guidance

The transformation architecture should maintain a provider-agnostic boundary.

The mobile client should not need to know which image provider performs the transformation.

The server-side transformation layer should own:

- prompt construction;
- semantic / transformation instructions;
- provider selection;
- post-processing;
- transparency cleanup;
- provider-specific adaptation.

The product must remain able to benchmark or replace providers without rewriting the mobile transformation flow.

This specification changes **behavioral intent**, not the provider abstraction or current mobile product flow.

---

## 23. Non-goals

This specification does not authorize:

- generic text-to-image generation disconnected from the source doodle;
- stock sticker replacement as the normal transformation path;
- arbitrary creative redesign;
- silent Level 4 reimagination;
- style recipes inventing semantics;
- changing the mobile UX flow solely to support this philosophy;
- requiring a specific image provider;
- changing production infrastructure as part of this documentation update.

---

## 24. Acceptance checklist

An implementation aligns with Dooji Transformation Spec v1.2 when:

- [ ] The default philosophy is Intent-Preserving Stylized Reconstruction.
- [ ] Similarity is treated as semantic / expressive / compositional rather than stroke-level.
- [ ] Subject identity is preserved.
- [ ] Expression is preserved and polished rather than copied literally.
- [ ] Pose and orientation are treated as strong anchors.
- [ ] Major distinctive proportions and features are preserved.
- [ ] Rough drawing execution can be substantially reconstructed.
- [ ] Level 0–2 transformation is allowed in normal Dooji use.
- [ ] Level 2 reconstruction is treated as a core behavior, not an edge case.
- [ ] Style is applied after semantic reconstruction.
- [ ] Gummy, Clay, Plush, and Glossy remain first-class and visually distinct.
- [ ] Plush does not drift into photoreal animal fur.
- [ ] Final output is a clean transparent sticker by default.
- [ ] Style recipes do not invent semantics.
- [ ] Unsupported accessories / anatomy / faces are not casually added.
- [ ] The provider prompt does not over-constrain exact stroke preservation.
- [ ] Evaluation rewards meaningful reconstruction and polish.
- [ ] Evaluation does not penalize substantial geometry change when creative anchors are preserved.
- [ ] Production remains provider-agnostic.
- [ ] Render identity and reproducibility metadata are maintained.

---

## 25. Changelog

### v1.2 — Intent-Preserving Stylized Reconstruction

This version deliberately loosens the strict preservation model from v1.1.

### Main change

Dooji moves from primarily **preserving geometry with recognition assistance** to **reconstructing the user's intended object while preserving meaningful creative anchors**.

### Specifically changed

- Exact stroke geometry is no longer treated as a primary preservation requirement.
- Silhouette may be cleaned and meaningfully reconstructed.
- Expression, pose, orientation, major proportions, and distinctive features become the strongest preservation anchors.
- Drawing execution artifacts are explicitly disposable.
- Level 2 semantic reconstruction becomes normal Dooji behavior.
- Polish is encouraged to be substantially stronger.
- Similarity is defined semantically, expressively, and compositionally rather than pixel/stroke-wise.
- Evaluation is updated so that reconstruction quality and polish are rewarded instead of penalized.
- Anti-generic guardrails remain in place to prevent stock/canonical reimagination.
- Style application remains downstream of semantic reconstruction.

### Product intent

The change is designed to support users who **cannot draw well but know what they want to create**.

Dooji should not punish drawing ability. The user's rough sketch communicates the idea; Dooji provides the execution and stylization.

---

*End of Dooji Transformation Spec v1.2*
