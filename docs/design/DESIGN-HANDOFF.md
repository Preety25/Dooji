# Dooji — Design Handoff

**Status:** Implementation-oriented design handoff for MVP  
**Owner:** Product / Design  
**Scope:** Mobile visual + interaction presentation  
**Behavior source of truth:** [`docs/product/PRODUCT-CONTRACT.md`](../product/PRODUCT-CONTRACT.md)  
**Technical source of truth:** [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md)

> This document defines **how** the approved Dooji experience should look, feel, and behave visually.  
> The Product Contract remains the authority for product behavior. Where a visual detail is not present in the approved screens, it is marked **TBD** — not invented.

### Visual sources used for this handoff

Approved iPhone MVP screens (Canvas empty / active / dark, Preview, Generating, Result generated / ungenerated CTA / semantic uncertainty, Library overview / Creation detail), plus the product material style sheets under `product/assets/style_sheets/` for material language only.

---

## 1. Design Purpose

Dooji should feel **playful but premium**, **delightful**, **quiet and confident**, **modern**, **tactile**, and **expressive** — not childish, and not an AI dashboard.

The interface communicates three ideas immediately:

1. **You make the idea** — the user starts with a hand-drawn doodle.
2. **Dooji improves the execution** — the result becomes dimensional and polished without erasing authorship.
3. **The interaction stays light** — little configuration between drawing and seeing the result.

The **user's doodle remains the hero** on Canvas and Generating; the **generated Dooji** is first revealed on Result. Preview withholds the doodle so transformation feels like a deliberate reveal. Transformation should feel magical while preserving the feeling that the result came from *their* mark.

Avoid:

- generic AI dashboards / model consoles
- dense illustration editors
- technical generation workflows
- childish sticker-kitsch
- photorealistic product photography language in the UI

---

## 2. Design Principles

- Preserve the user's idea.
- Improve execution without erasing authorship.
- Keep the interface visually simple.
- Let the doodle / generated artwork dominate attention **on the screens where they belong** (Canvas / Generating / Result — not Preview).
- Use dimensional material language consistently across Preview and Result tiles.
- Avoid unnecessary UI chrome.
- Make state changes obvious but subtle.
- Make cached experiences feel instant.
- Prefer delight through motion, material, and reveal — not excessive UI.
- Favor clarity over feature density.
- Do not invent "AI reasoning" UI that the product does not actually perform.

### Withhold the reveal

Dooji should **not** show an intermediate AI interpretation before generation.

| Screen | Role |
|---|---|
| **Canvas** | User's idea (original drawing) |
| **Preview** | Visual possibility (material / style language only) |
| **Generating** | Anticipation |
| **Result** | Transformation reveal (first time the user sees the transformed Dooji) |

Therefore Preview style tiles feel like selecting a **material for a future transformation**, not selecting among four generated versions of the user's doodle.

---

## 3. Screen Inventory

| # | Screen / state | Purpose |
|---|---|---|
| 1 | Canvas | User creates the source doodle; Make it ✨ opens Preview |
| 2 | Preview | User chooses a material / style only (no doodle, no AI output) |
| 3 | Generating | Dooji transforms the doodle using the chosen style |
| 4 | Result | User sees the transformed Dooji for the first time |
| 5 | Library (overview) | User returns to saved Creations |
| 6 | Library Creation detail | Variants belonging to one Creation |
| 7 | New Doodle confirmation | Unsaved / dirty protection (**visual TBD**) |
| 8 | Technical error | Retry + Edit doodle (**full visual TBD**) |
| 9 | Semantic uncertainty | Backend-signaled uncertainty on Result-like layout |

### Journey summary

```text
Canvas     → user's idea
Preview    → choose material / style
Generating → anticipation
Result     → transformation reveal
Library    → saved Creations + variants
```

For each screen below: purpose, hierarchy, major components, primary / secondary actions, state, interaction, and next transition.

---

## 4. Canvas

### Purpose

Default entry point. Capture the user's doodle. **Make it ✨ opens Preview** — it does **not** start generation.

### Hierarchy (approved screens)

```text
Header: dooji wordmark · Library grid · light/dark toggle
Drawing area (hero)
Color swatches
Drawing toolbar (undo / redo · pen · eraser · sizes · clear)
Make it ✨ (primary CTA)
```

### Major components

| Component | Notes from approved screens |
|---|---|
| Wordmark | Lowercase `dooji`; interlocking red `oo` mark |
| Library affordance | Soft rounded square with 2×2 grid icon |
| Theme toggle | Pill with sun / moon face (light vs dark) |
| Drawing surface | Large central area; white/light in light mode |
| Empty placeholder | Squiggle + `Start drawing...` + `We'll use our magic` |
| Color palette | Row of circular swatches (eight in comps) |
| Drawing toolbar | Pill bar: undo, redo, pen, eraser, brush sizes, trash/clear |
| Make it ✨ | Full-width pill CTA |

### Empty state

- Placeholder graphic + copy centered in the drawing area.
- Undo / redo / clear appear muted / disabled when there is nothing to undo or clear.
- Pen tool shown as active (filled circular treatment).
- **Make it ✨** appears muted / inactive when there is no drawable content (light grey treatment in empty comps).

### Active drawing state

- Placeholder **disappears as soon as the user begins drawing / meaningfully interacting**.
- Doodle strokes are the visual hero.
- Make it ✨ becomes visually primary (filled purple treatment with white label in active light-mode comps).

### Dirty state

Visual dirty indicator beyond stroke presence: **TBD**. Behavior for New Doodle dirty prompts is defined in the Product Contract; confirmation chrome is TBD (see §10).

### Light / dark mode

- Light: soft cool-neutral / lavender-tinted surfaces; white canvas field.
- Dark (approved empty Canvas): deep charcoal / navy surface; light placeholder text; same control structure; Make it ✨ uses a quieter filled treatment with warm label accents.
- Exact dark tokens: **TBD**.

### Primary action

**Make it ✨** → navigate to **Preview** (no Transform API call).

### Secondary actions

Library; theme toggle; drawing tools (undo, redo, pen, eraser, size, clear).

### Transition

Canvas → Preview (on Make it ✨ with strokes).

---

## 5. Preview

**Critical screen.** Behavior follows the Product Contract; visuals follow the latest approved Preview comps.

### Preview purpose

Preview is a **material / style selection moment**, not a visual preview of the generated result.

The user does **not** see their doodle on this screen.

The purpose is to establish anticipation and let the user choose the visual treatment **before** transformation.

### Preview composition

The visual hierarchy is spacious and centered:

1. Dooji header / navigation (wordmark · Library · theme toggle)
2. Heading: **“Pick a style for your Dooji”**
3. 2×2 style / material grid
4. **Surprise me ✨**

```text
Header: dooji · Library · theme toggle
“Pick a style for your Dooji”
[ Gummy ] [ Clay ]
[ Plush ] [ Glossy ]
Surprise me ✨
```

### Preview does not show the user's artwork

**The user's doodle is intentionally hidden during Preview. The generated interpretation is revealed for the first time on the Result screen.**

Preview must **not** contain:

- the user's doodle
- transformed artwork
- generated result
- AI output
- user-specific object preview
- `Make it [Style] ✨` CTA
- any confirmation CTA

This creates a deliberate reveal: choose material → watch Generating → see the transformed Dooji on Result.

### Explicit rules (must not regress)

| Rule | Requirement |
|---|---|
| Initial `selectedStyle` | **`undefined`** |
| Default Gummy | **None** |
| User doodle | **NOT shown** |
| Generation CTA on Preview | **None** |
| Tap style tile | Immediately begin cache / generation flow |
| Tap Surprise me ✨ | Random local style → same immediate flow · no confirmation · not “best” |
| Style preview assets | **Static material reference assets** · **must not** require an AI / Transform call |
| Persistent selected state on Preview | **Not required** — brief pressed/touch feedback only |

### Style tiles

Each tile is a **STATIC representative material reference**.

They are **not**:

- generated from the user's doodle
- user-specific
- API responses
- live transformations
- four generated versions of the same object

They **should** communicate:

- material
- texture
- dimensionality
- visual personality

They should **not** communicate the user's object identity.

Each tile contains:

1. material preview asset (orb)
2. style name

Canonical labels and grid order (always):

```text
Top left:     Gummy
Top right:    Clay
Bottom left:  Plush
Bottom right: Glossy
```

| Style | Orb language (approved Preview) |
|---|---|
| Gummy | Translucent pink/red · internal bubbles · wet highlights · juicy / gelatinous |
| Clay | Warm tan / terracotta · matte · soft sculpted ridges · polymer / play-doh |
| Plush | Purple · dense short-pile fuzz · stuffed-toy texture |
| Glossy | Opaque bright orange · crisp clearcoat speculars · polished resin / vinyl |

**Label rule:** Never label the bottom-right Glossy tile as “Clay”. Older exports with that mislabel are incorrect; implementation must always show **Glossy**.

Tiles use consistent camera / framing / scale / lighting language; only material treatment distinguishes them. Rounded-rectangle tile backgrounds; generous touch targets; composition remains spacious.

### Interactions

| Action | Behavior |
|---|---|
| Tap style tile | Set `selectedStyle` → cache lookup → Result (hit) or Generating (miss) immediately |
| Tap Surprise me ✨ | Randomly pick one of four styles locally → same flow |
| Confirmation | **None** |
| Second tap | **Not required** |

Because navigation to Generating / Result happens immediately, do **not** require a persistent Preview “selected style” presentation.

### Spacing / touch targets

Generous whitespace; large tiles. Exact padding / tile size / hitSlop: **TBD**.

### Transitions

| From Preview | Next |
|---|---|
| Style tile or Surprise me · cache miss | Generating |
| Style tile or Surprise me · cache hit | Result (prefer instant; no unnecessary Generating) |

---

## 6. Material Style Language

Shared family (Preview orbs + generated stickers):

- premium stylized 3D
- designer-toy / soft-sculpture / candy-illustration feel
- compatible scale, camera/framing, lighting logic
- dimensional quality — **not** flat 2.5D, hard CAD, stock 3D, or photoreal
- **only the material treatment should change** where appropriate
- no ground plane / unnecessary scene background on final stickers

### Preview assets = static material references

The four Preview assets are **STATIC MATERIAL REFERENCE ASSETS**.

They are **not** user-specific, not generated per doodle, not API responses, and not live transformations.

Canonical material sheets (generation language): `product/assets/style_sheets/sheet_{gummy,clay,plush,glossy}.png`.  
UI Preview/Result orbs are dedicated product chrome assets that teach the same material identity.

### Gummy

Translucent · juicy · soft · inflated · bubbly · wet highlights · luminous edges · stylized 3D. **Not** photoreal food.

### Clay

Matte · warm · soft sculpted polymer / play-doh · puffy · tactile · subtle handmade variation. **Not** glossy · **not** gummy · **not** ceramic glaze photo.

### Plush

Stuffed · fuzzy · dense short-pile · puffy · soft-toy character · tactile compression. **Not** clay.

### Glossy

Opaque · solid · polished resin / vinyl / hard-candy · rich color · crisp reflections · clearcoat / polished toy. **NOT** translucent · **NOT** glass · **NOT** pearlescent / iridescent.

---

## 7. Generating

### Purpose

Communicate that a real transformation is underway — calm, sparse, not a progress dashboard.

### Hierarchy (approved Loading screen)

```text
User doodle (hero, centered)
"Making it Dooji..."
"Hang tight ... this takes a moment."
```

### What remains visible

The **user's doodle** remains the visual hero during generation (approved comps show the source doodle, not a spinner-dominated UI).

### Copy

| Role | Approved copy |
|---|---|
| Primary | `Making it Dooji...` |
| Supporting | `Hang tight ... this takes a moment.` |

Avoid provider names, "calling model", fake percentage progress unless real progress exists.

### Animation principles

Exact durations / curves: **TBD**. Direction:

- quiet confidence · no aggressive spinner owning the screen
- subtle motion only if needed
- Generating → Result should feel like a reveal / arrival
- respect reduced motion (**TBD** specifics)

### Transitions

| Event | Next |
|---|---|
| Enter from Preview (cache miss) | Generating |
| Success | Result |
| Technical failure | Technical error treatment (§11) |

---

## 8. Result

### Purpose

**Result is the first screen where the user sees the actual transformation.**

It is the payoff for the material choice made on Preview. The hero artwork (`activeAsset`) is the primary focus. Controls support style switching, generation of missing styles, Save, Share, Edit, and New Doodle — without competing with the artwork.

Result introduces:

- the generated Dooji (first reveal)
- the selected material / style context
- style switching among cached variants
- checkmarks on generated styles
- contextual missing-style CTA

### Hierarchy (approved Result)

```text
Back · status (“Looking good 👀”) · Library · theme toggle
Generated Dooji hero (activeAsset)   ← first reveal of transformed artwork
[optional semantic banner]
“Change style”  [ contextual Make it [Style] ✨ when needed ]
[Gummy][Clay][Plush][Glossy]   ← checkmarks on generated
[ Save ]     [ Share ]
Edit doodle  |  New doodle
```

### Style selector states (critical)

| Condition | Visual (from comps) | Interaction |
|---|---|---|
| Generated for current source | Checkmark badge (purple circle + white check) | Tap → **instant** `activeAsset` switch · no API · no loading · no credits |
| Selected + generated | Checkmark + selection border / emphasis; label weight may strengthen | Same instant switch |
| Ungenerated | No checkmark | Tap → **selection only** · expose lime contextual CTA |
| Selected + ungenerated | Selection border · **no** checkmark · lime `Make it [Style] ✨` | Generation **only** when CTA pressed |

`selectedStyle` ≠ `activeAsset`. Hero reflects `activeAsset`. Contextual CTA targets the selected ungenerated style (example from comps: `Make it clay` on lime pill when Clay is selected but not yet generated).

### Actions

| Action | Visual role (comps) | Behavior |
|---|---|---|
| Save | Outlined / light pill | Explicit Library save (≠ generation) |
| Share | Filled purple pill + share icon | Share current `activeAsset` |
| Edit doodle | Text + pencil | Return to Canvas |
| New doodle | Text + plus | New Doodle flow (Product Contract prompts) |

Save success feedback: **TBD**. Share sheet transition: **TBD** (prefer OS share; confirm in implementation).

### Transitions

Result → Generating (missing-style CTA) · Result → Canvas (Edit) · Result → New Doodle flow · Result → Library.

---

## 9. Library

### Philosophy

**Creation-first.** One Library item = one original Creation / doodle. Generated styles are variants of that item — not separate top-level Creations.

### Library overview (approved)

```text
← Library
[Card] [Card]
[Card] …
```

**Library card**

- Rounded square artwork preview on soft cream / off-white tile
- Title + variant count, e.g. `Cat (3)`
- Date metadata, e.g. `Sep 24`

Titles like Cat / Flower / Mug in comps are **mock content**, not a confirmed auto-naming requirement (Product Contract does not require rename / AI titles for MVP).

### Library Creation detail (approved)

```text
← Library
Creation context title (e.g. Cat)
Grid of variants: "Your doodle", "Gummy", "Plush", …
Timestamps under tiles
```

Groups original doodle + generated style variants under one Creation.

### MVP actions (Product Contract)

open / view · switch generated styles · generate missing style (via Result rules) · share · edit doodle · delete Creation

### Out of scope (do not design into MVP)

rename · duplicate · favorites · collections · tags · advanced organization

### Visual TBDs

Empty Library state · delete affordance + confirmation styling · how "generate missing style" is entered from detail vs Result · exact card radii / gutters.

---

## 10. New Doodle Confirmation

Behavior is fixed in the Product Contract. **Approved screen comps do not include the confirmation UI** — visual treatment is **TBD**.

### Unsaved content or result

Copy: `Save this Dooji before starting a new one?`  
Actions: **Save** · **Don't save** · **Cancel**

### Saved but dirty

Copy: `Save your changes?`  
Actions: **Save changes** · **Discard** · **Cancel**

### Empty / clean or saved + unchanged

Open new Canvas immediately (no prompt).

### Visual TBD

Modal vs bottom sheet · button hierarchy · destructive styling · dismiss / Android back · light/dark treatment.

---

## 11. Error States

### Technical error

| Element | Spec |
|---|---|
| When | Transform / network / provider technical failure |
| Copy | Clear explanation — exact string **TBD** (directional only if not in final comps) |
| Actions | **Retry** (technical only) · **Edit doodle** |
| Not | "Try another style" · former **Try Another** (removed entirely) |

Full technical-error layout was **not** among the finalized screen set used for this handoff → treat chrome as **TBD** while preserving Product Contract actions.

### Semantic uncertainty

| Element | Spec |
|---|---|
| When | **Only** when backend provides a trustworthy explicit signal |
| Not | Client-side "weirdness detector" |
| Approved banner copy | `We weren't totally sure what this was...` |
| Product Contract phrase | Also allows `A little mysterious.` — **copy reconciliation TBD** |
| Actions (approved + contract) | **Edit doodle** · **Keep it weird** |
| Layout | Inline banner on Result-like screen (light grey rounded bar; dark **Keep it weird** pill) |

Keep it weird should retain the result and dismiss / accept the uncertainty presentation without implying the user failed.

---

## 12. Components

Reusable inventory supported by the approved designs / Product Contract flows:

| Component | Role |
|---|---|
| `DoojiWordmark` | Brand in header |
| `LibraryIconButton` | Open Library |
| `ThemeToggle` | Light / dark |
| `BackButton` | Secondary navigation |
| `DrawingCanvas` | Stroke surface |
| `EmptyCanvasPlaceholder` | Squiggle + Start drawing copy |
| `ColorSwatchRow` | Palette |
| `DrawingToolbar` | Undo/redo, pen, eraser, sizes, clear |
| `MakeItButton` | Canvas → Preview |
| `StyleTile` | Preview + Result material tile |
| `StyleSelector` / `StyleGrid` | Four-style arrangement |
| `SurpriseMeButton` | Preview random style |
| `GenerationView` | Generating screen |
| `ResultHero` | Active generated asset |
| `ResultStatusLine` | e.g. Looking good 👀 |
| `ContextualMakeItButton` | Result `Make it [Style] ✨` (lime) |
| `SaveButton` / `ShareButton` | Result primary pair |
| `EditDoodleAction` / `NewDoodleAction` | Footer text actions |
| `LibraryCard` | Overview Creation card |
| `VariantCard` | Creation-detail variant |
| `SemanticUncertaintyBanner` | Inline uncertainty |
| `ErrorState` | Technical failure (**TBD** chrome) |
| `ConfirmationModal` / `Sheet` | New Doodle prompts (**TBD** chrome) |

Do not invent components for out-of-scope Library organization.

---

## 13. States

### Product state reminders (unchanged architecture)

| Moment | `selectedStyle` | Notes |
|---|---|---|
| Canvas | `undefined` (typical) | Drawing |
| Preview entry | `undefined` | No default |
| Preview style tap | Chosen style | Immediately cache/generate — no persistent Preview selection UI |
| Preview Surprise me | Randomly chosen style | Same immediate flow |
| Result | Separate from `activeAsset` | Selection vs displayed generated asset |

### Visual state matrix

| State | What changes visually |
|---|---|
| Empty (Canvas) | Placeholder visible; Make it muted; history tools disabled |
| Active (Canvas) | Placeholder gone; doodle visible; Make it primary |
| Preview idle | Style grid + Surprise me; no doodle; no persistent tile selection |
| Preview press | Brief touch feedback only (**TBD** exact treatment) |
| Selected (Result tile) | Border / emphasis; may combine with generated or not |
| Generated | Checkmark badge present |
| Ungenerated | No checkmark; may show lime CTA when selected |
| Loading (Generating) | Doodle hero + calm copy; minimal chrome |
| Success (Result) | Hero = activeAsset (first reveal); style row reflects cache |
| Semantic uncertainty | Inline banner + Keep it weird / Edit |
| Technical error | Clear message + Retry / Edit (**chrome TBD**) |
| Disabled | Muted icon/text/CTA (empty-canvas tools / Make it) |

---

## 14. Interaction & Motion

| Interaction | Principle | Timing |
|---|---|---|
| Tap / press | Obvious but subtle feedback | **TBD** |
| Preview style / Surprise | Immediate commit to cache/generation | Instant intent |
| Cached Result switch | Crossfade or subtle swap; feels faster than generate | **TBD** (must feel instant) |
| Generation | Enter Generating; then Result reveal | Reveal curve **TBD** |
| Navigation | Stable headers; avoid layout thrash | **TBD** |
| Save feedback | Confirm without stealing hero | **TBD** |
| Share | Prefer OS share sheet | Transition **TBD** |
| Edit | Return to Canvas with strokes | Direct |
| New doodle | Prompt when required | Sheet/modal motion **TBD** |
| Error recovery | Calm; Retry = technical only | **TBD** |

Do not invent final ms / spring values. Prefer reduced-motion alternatives when the OS requests them (**TBD**).

---

## 15. Typography

Observed roles from approved screens (exact families / sizes / weights / line-heights: **TBD**):

| Role | Observation |
|---|---|
| Wordmark | Rounded lowercase sans; custom `oo` treatment |
| Empty Canvas headline | Mixed treatment: serif "Start" + italic / script emphasis on "drawing..." |
| Preview heading | Editorial serif: `Pick a style for your Dooji` |
| Generating headline | Bold serif: `Making it Dooji...` |
| UI labels / buttons | Clean sans (Save, Share, Surprise me, style labels on Result) |
| Metadata | Smaller grey sans (Library dates) |

Do not assume implementation fonts (e.g. interim Expo Fredoka) are the approved design system.

---

## 16. Color

Exact hex values: **TBD** (do not sample-as-token from screenshots). Roles observed in approved comps:

| Role | Direction |
|---|---|
| Surfaces | Soft cool off-white / pale lavender; Library cards cream/beige |
| Text primary | Near-black / charcoal |
| Text secondary | Medium grey |
| Brand / primary accent | Soft–mid purple (Share, selection border, checkmark badge, active Make it) |
| Accent green | Lime contextual `Make it [Style] ✨` on Result |
| Logo accent | Red interlocking `oo` |
| Drawing palette | Vivid swatches (black, purple, orange, cyan, pink, lime, yellow, white, …) |
| Dark mode surfaces | Deep charcoal / navy (**tokens TBD**) |
| Semantic / error | Dark pill for Keep it weird; technical error styling **TBD** |

---

## 17. Spacing / Layout / Geometry

| Topic | Direction from comps | Exact values |
|---|---|---|
| Layout | Vertical stack; hero centered; controls bottom-weighted | **TBD** |
| Content padding | Generous margins; calm whitespace | **TBD** |
| Component spacing | Consistent gaps between palette / toolbar / CTA | **TBD** |
| Corner radius | Soft pills; large radii on cards / tiles / buttons | **TBD** |
| Touch targets | Comfortable; icons smaller than hit area | Min size **TBD** (aim ≥ platform guidance) |
| Artwork framing | Centered; full object visible; no busy scene chrome | Padding **TBD** |
| Responsive | Portrait phone primary; respect safe areas | Device matrix **TBD** |

---

## 18. Accessibility

- Maintain readable contrast for text / icons in light and dark (**verify TBD**).
- Touch targets must remain usable even when icons are small.
- Do not communicate generated / selected **only** via color — use checkmarks, borders, labels.
- Provide screen-reader labels for icon-only controls (Library, theme, undo, share, etc.) — exact strings **TBD**.
- Style tiles should announce style name + whether generated / will generate.
- Honor reduced motion where the platform supports it — motion alternatives **TBD**.
- Pressed / focused / disabled states must be perceivable beyond color alone.

---

## 19. Assets

### Required static design assets

| Asset | Notes |
|---|---|
| Gummy / Clay / Plush / Glossy Preview orbs | **Static material reference assets**; shared with Result tiles; **no AI call**; not user-specific |
| Wordmark / `oo` mark | Brand |
| Icons | Library grid, back, undo/redo, pen, eraser, trash, share, pencil, plus, checkmark, theme faces |
| Empty-canvas squiggle | Placeholder illustration |
| Theme toggle faces | Sun / moon (as in comps) |

### Generation / reveal

No separate Lottie / sparkle asset is specified in comps → **TBD** if any motion asset is needed beyond UI transitions.

### Material sheets

`product/assets/style_sheets/*` are **generation style language**, not automatically the UI Preview orbs (UI orbs are dedicated product chrome assets matching the same material identity).

---

## 20. Visual QA Checklist

- [ ] Spacing and hierarchy match approved comps (within token TBD tolerance)
- [ ] Typography roles match (serif vs sans vs emphasis)
- [ ] Color roles restrained; purple / lime used intentionally
- [ ] Artwork scale / framing keeps full object visible
- [ ] Material fidelity: Gummy ≠ Clay ≠ Plush ≠ Glossy at a glance
- [ ] Preview: **no user doodle**; no default selection; no Make it CTA; static orbs only
- [ ] Preview labels: Gummy / Clay / Plush / Glossy (bottom-right = Glossy, never Clay)
- [ ] Preview / Surprise me immediately start cache/generation flow
- [ ] Result is first reveal of transformed Dooji; hero dominates
- [ ] Result: checkmarks only on generated; instant cached switches
- [ ] Result: ungenerated selection shows lime Make it [Style] ✨ only
- [ ] Generating: doodle visible; calm copy; no fake %
- [ ] Light / dark Canvas hierarchy preserved
- [ ] Library creation-first; detail groups variants
- [ ] Semantic uncertainty only with backend signal; Keep it weird / Edit
- [ ] Technical Retry only for technical failure; no Try Another
- [ ] Save distinct from generation
- [ ] Safe areas / responsive portrait behavior
- [ ] Accessibility: contrast, labels, non-color state cues, reduced motion
- [ ] Motion: cached switches feel instant vs generation reveal

---

## 21. Known TBDs

Genuinely unresolved visual / secondary decisions (product behavior above is **not** TBD):

1. Exact design tokens (hex, type ramp, radii, spacing scale) from Figma / final files
2. Exact font family names and size/weight/line-height specs
3. Exact animation timings / springs for all transitions
4. New Doodle confirmation modal vs sheet visual treatment
5. Empty Library visual + copy
6. Save success feedback
7. Share transition / export presentation
8. Delete Creation affordance + confirmation styling
9. Technical error full-screen / inline chrome + final copy
10. Semantic uncertainty headline: approved banner vs Product Contract `A little mysterious.` reconciliation
11. Brief Preview pressed/touch feedback treatment (no persistent selected state)
12. Exact Canvas tool behaviors (brush size mapping, eraser rules) beyond icons shown
13. Result / Generating back navigation while a request is in flight

**Decided — not TBD:** Preview does **not** show the user's doodle. Glossy is the bottom-right style label. Preview has no generation CTA and no default style.

---

## Document Status

**Status:** Design handoff for MVP visual / interaction implementation  

**Ready for primary visual implementation;** exact design-system tokens and certain secondary states remain TBD.

**Not pixel-final** until tokenization, motion specs, and §21 TBDs are closed.

**Related docs**

- Behavior → `docs/product/PRODUCT-CONTRACT.md`
- Implementation → `docs/architecture/ARCHITECTURE.md`
- Device E2E evidence → `docs/golden-path-device-e2e.md`
