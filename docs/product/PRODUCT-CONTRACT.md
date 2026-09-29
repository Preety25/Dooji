# Product Contract

## 1. Purpose

Dooji turns a messy doodle into a delightful, shareable stylized sticker **without making it stop feeling like yours**.

Core product thesis:

> Draw something messy. We will make it look good without making it stop feeling like yours.

Underlying principles:

- Improve the execution.
- Preserve the idea.
- Preserve authorship.
- Prefer stylized dimensionality over realism.
- The doodle determines **what** the object is.
- The style determines **how** it becomes beautiful.

Core moat:

- doodle understanding
- authorship-preserving stylization
- delightful transformation / reveal
- easy sharing

Dooji is **not** a generic AI image generator, prompt playground, or AI dashboard. The experience should feel playful and magical, not like operating a model console.

---

## 2. Core Product Model

A **Creation** is the fundamental unit of Dooji.

A Creation consists of:

- the original doodle / stroke source (canonical)
- the canvas / source representation
- generated style variants derived from that source
- timestamps and relevant metadata
- a persistent identity for that Creation

**One Library item represents one original Creation.**  
Generated styles are **variants of that Creation**, not separate Creations.

| Concept | Role |
|---|---|
| Original doodle / strokes | Canonical source of truth |
| Generated images | Derived representations for a specific style + source state |
| Library item | One Creation that may hold multiple style variants |

Users should always feel they are improving *their* doodle, not replacing it with an unrelated polished object.

---

## 3. Supported Styles

Canonical style IDs / names:

| ID | Display name |
|---|---|
| `gummy` | Gummy |
| `clay` | Clay |
| `plush` | Plush |
| `glossy` | Glossy |

### Gummy

Juicy, soft, inflated, translucent, bubble-like. Wet highlights, luminous edges, stylized dimensionality. **Not** photorealistic food.

### Clay

Soft sculpted matte polymer / play-doh appearance. Puffy, warm, tactile, subtle sculpting variation, handmade quality. **Not** ceramic, glossy, or gummy.

### Plush

Stuffed, fuzzy, short-pile soft-toy appearance. Puffy, tactile compression, nap/fuzz; seams only when they make sense. **Not** clay.

### Glossy

Solid, opaque, polished resin / vinyl / hard-candy toy appearance. Rich color, crisp clearcoat, polished toy-like dimensionality, strong controlled reflections. **Not** wire sculpture, glass, pearl/iridescent soap, or translucent jelly.

### Shared visual language

- premium stylized 3D
- designer-toy / soft-sculpture / candy-illustration feel
- not generic stock 3D
- not photorealistic
- not flat 2.5D
- not hard CAD

Object-specific framing/camera may adapt to the object. Final generated output should not depend on a ground plane or unnecessary scene background.

---

## 4. Core User Journey

Canonical journey:

**Canvas → Preview → Transformation → Result → Library**

More specifically:

1. User draws on **Canvas**
2. Tap **Make it ✨**
3. Enter **Preview** (no generation yet)
4. User taps a **style tile** **or** **Surprise me ✨**
5. Transformation begins immediately (cache or generate)
6. **Generating** (only when a network/provider generation is required)
7. **Result**

### Preview (critical)

Enter Preview from Canvas via **Make it ✨**. Preview does **not** call the Transform API by itself.

Preview is a **material / style selection** moment — **not** a visual preview of the user’s transformed doodle. The user’s doodle remains on Canvas and is **intentionally withheld** from Preview. The transformed Dooji is first revealed on **Result**.

| Rule | Behavior |
|---|---|
| `selectedStyle` on entry | **`undefined`** — nothing selected |
| Default style in UI | **None** — no default Gummy (or any other default) |
| User doodle | **NOT shown** |
| Style tiles | Four **static** material previews: Gummy, Clay, Plush, Glossy (product chrome; not live / user-specific renders) |
| Surprise me ✨ | Shown on Preview |
| Generation CTA on Preview | **None** — no “Make it [Style] ✨” on Preview |

Canonical tile order:

```text
Gummy     Clay
Plush     Glossy
```

**When the user taps a Preview style tile:**

1. Immediately set `selectedStyle` to that style.
2. Perform cache lookup for Creation + current source fingerprint + style + version pins.
3. **Cache hit** → immediately show **Result** with the cached asset as `activeAsset` · no API call · no usage/credit consumption · no Generating phase unless product copy requires a flash (prefer instant).
4. **Cache miss** → start generation immediately · no confirmation step.

**When the user taps Surprise me ✨ on Preview:**

1. Randomly choose one of the four supported styles **locally** (not a “best style” recommendation).
2. Immediately run the same cache lookup / generation flow as a style-tile tap.
3. No confirmation step.
4. Do not claim the system predicted the best style.

---

## 5. Product State Machine

Intended product phases:

| Phase | Meaning |
|---|---|
| `canvas` | Drawing / editing the doodle |
| `preview` | Style choice; no style selected initially |
| `generating` | A real generation request is in progress |
| `result` | Viewing / switching generated assets |

### Canvas

- User draws / edits doodle.
- **Make it ✨** enters Preview.
- Entering Preview must **not** start generation by itself.

### Preview

- Phase value: `preview`.
- `selectedStyle` starts **`undefined`**.
- Shows heading + four static material tiles + Surprise me ✨.
- Does **not** show the user’s doodle, a transformed doodle, or any AI output.
- No generation CTA on this screen.
- Style tile or Surprise me → immediate cache/generation flow (see §4).
- No persistent selected-style presentation is required on Preview (brief press feedback only).

### Generating

- Generation is in progress.
- Prevent duplicate requests for the same Creation + source fingerprint + style while a matching request is already in flight.
- Success → Result.
- Technical failure → error handling (Retry + Edit doodle).

### Result

- Phase value: `result`.
- Show the current generated asset (`activeAsset`) as hero.
- Styles that already have a **valid** generated asset for the current source display a **checkmark** (or equivalent generated indicator).
- Tapping a **generated** style: instantly switch `activeAsset` · no API · no loading · no credit usage.
- Tapping an **ungenerated** style: set `selectedStyle` only · show contextual CTA **Make it [Style] ✨** · generation runs **only** when that CTA is pressed.
- Also allow Save, Share, Edit doodle, New Doodle.

---

## 6. Style Selection Rules

These are **not** the same thing:

| Term | Meaning |
|---|---|
| `selectedStyle` | Temporary UI selection / request target — **not** the same as `activeAsset` |
| `activeAsset` | Generated image currently displayed on Result |
| Generated / cached styles | Styles that already have a **valid** asset for the **current** source (fingerprint + version pins) |

Product phases: **`canvas` | `preview` | `generating` | `result`**.  
`selectedStyle` and `activeAsset` must remain conceptually separate across Preview and Result.

### On Preview

Tapping a style **is** the generation action (after cache check).

### On Result

| Style status | Tap behavior |
|---|---|
| Already generated for current source | Instantly display cached asset · no API · no credit · no generating state |
| Not yet generated | Select that style · show contextual CTA **Make it [Style] ✨** · generate only when CTA is pressed |

The Result CTA behavior does **not** apply to Preview.

---

## 7. Generation and Credit Rules

Generation is an explicit transformation operation.

Before any generation flow:

1. Look up a compatible cached result.
2. Only then consider entitlement / usage.
3. Only then show generating UI / call the Transform API.

| Outcome | Behavior |
|---|---|
| Cache hit | Immediate display · no API · no credit · no unnecessary loading |
| Cache miss | Perform **one** generation · persist/cache the successful asset |

A matching in-flight generation for the same **Creation + doodle/source fingerprint + style** must not produce duplicate generation requests.

---

## 8. Source / Fingerprint Rules

The original doodle / stroke data is canonical.

Generated assets are associated with a specific source state / fingerprint.

| Situation | Rule |
|---|---|
| User edits strokes / source | Previous assets may remain in history, but must **not** be treated as valid for the new source |
| Changed source | Must have a different fingerprint / version identity |
| No actual doodle change | Existing generated assets remain valid |

---

## 9. Saving vs Generation

| Action | Meaning |
|---|---|
| Successful generation | Automatically caches / persists the generated asset on the Creation |
| Save | Explicit Library action — intentional save of the Creation |

Generation does **not** by itself mean the user has intentionally saved the Creation to the Library.

Once a Creation is saved:

- it represents one original doodle
- generated styles belong to that same Library item
- generating another style updates that same Library item
- do **not** create duplicate Library entries per style

---

## 10. New Doodle Behavior

### Empty / clean canvas

Starting a new doodle opens a new canvas immediately.

### Unsaved content or result

Show: **“Save this Dooji before starting a new one?”**

Actions: **Save** · **Don’t save** · **Cancel**

### Saved and unchanged

Open a new canvas immediately.

### Saved but dirty

Show: **“Save your changes?”** (or equivalent save-changes prompt)

Actions: **Save changes** · **Discard** · **Cancel**

Dirty state is based on meaningful changes to the current Creation / source (and related work that would be lost).

Never silently discard doodles or generated results.

---

## 11. Library

Library is **Creation-first**.

**One Library item = one original Creation / doodle.**  
A Creation may contain multiple generated style variants.

### MVP Library actions

- open / view Creation
- switch among generated styles
- generate a missing style (via Result rules)
- share current generated asset
- edit doodle
- delete Creation

### Out of scope for MVP

- rename
- duplicate
- favorites
- collections
- tags
- advanced organization
- other nonessential library management

---

## 12. Edit Doodle

Editing returns the user to Canvas with the original strokes.

| Situation | Rule |
|---|---|
| No actual change | Existing generated assets remain valid |
| Strokes / source change | Old assets belong to the previous source · must not be treated as current for the edited doodle · history may remain · reuse must respect fingerprinting |

---

## 13. Error Handling

Separate **technical failure** from **semantic uncertainty**.

### Technical failure

- Clear error messaging
- **Retry**
- **Edit doodle**

Retry is for technical failures only.  
Do **not** use Retry as “try another style.”

### Try Another

**Removed entirely** from the product. It must not exist in UI, handlers, state, analytics, copy, or product logic.

### Semantic uncertainty

Only when the backend provides a trustworthy explicit signal.

Do **not** build a client-side “weirdness detector.”

Possible experience: **“A little mysterious.”**

Actions: **Edit doodle** · **Keep it weird**

Do not claim internal reasoning that is not represented by actual implementation.

---

## 14. Surprise Me

**Surprise me ✨** is an intentional product action.

It:

- randomly selects one supported style
- immediately starts the transformation flow
- does not ask for confirmation
- does not represent the system’s prediction of the “best” style
- does not require an AI recommendation model

---

## 15. Authorship / Transformation Principles

The transformation should preserve:

- the user’s underlying idea
- recognizable object identity
- meaningful composition / proportions
- recognizable distinctive doodle traits where possible
- the feeling that the result originated from the user’s doodle

The goal is **not** to replace the doodle with a completely unrelated polished object.

---

## 16. Product Principles

- Preserve the idea.
- Improve the execution.
- Make AI feel magical without making the interface feel like an AI dashboard.
- Keep the experience playful but premium.
- Favor clarity over feature density.
- Avoid unnecessary confirmation steps.
- Avoid unnecessary API calls and credit usage.
- Make cached results feel instant.
- Keep style selection understandable.
- Keep authorship visible.

---

## 17. MVP Boundaries

### In MVP

- Canvas doodle → Preview → generate → Result
- Four styles (Gummy, Clay, Plush, Glossy)
- Cache-aware generation
- Library Save / open / share / edit / delete
- New Doodle unsaved-work protection
- Technical failure Retry + Edit
- Provider-agnostic mobile ↔ server transform boundary

### Not MVP

- Recommendation engines for style
- Preview confirmation CTAs
- Try Another regeneration loops
- Client-side weirdness detectors
- Advanced library organization (rename, favorites, collections, tags)
- Pricing / entitlement UI (beyond hooks needed for generation gating)
- Speculative multi-provider UX surfaces

---

## Document Status

**Status:** Canonical product behavior for MVP  

**Owner:** Product / Design  

**Note:** This document defines **WHAT** Dooji does. Visual implementation belongs in a future `DESIGN-HANDOFF.md`. Technical implementation belongs in `docs/architecture/ARCHITECTURE.md`. Device E2E evidence for live LAN + xAI remains in `docs/golden-path-device-e2e.md`.
