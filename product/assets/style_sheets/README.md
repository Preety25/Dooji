# Canonical style sheets (product)

**Single product-level style system.** Sheets live here and are mirrored under
`docs/refs/style_sheets/` for lab path compatibility. Do not scatter duplicates
elsewhere.

| Style | File | Version (see `product/styles/*.json`) |
|---|---|---|
| Gummy | `sheet_gummy.png` | `product/styles/gummy.json` → `version` |
| Clay | `sheet_clay.png` | `product/styles/clay.json` |
| Plush | `sheet_plush.png` | `product/styles/plush.json` |
| Glossy | `sheet_glossy.png` | `product/styles/glossy.json` |

## Doctrine

Style sheets = **visual / material language ONLY**:

- Teach form language, material, lighting, surface, dimensionality, finish personality.
- Do **not** encode object identity — never copy sheet subjects, poses, faces, or palettes onto the user's doodle.
- Gummy sheet specifically: stylized 3D toy/candy gelatin (volume, bubbles, wet highlights) — not photoreal food, hard plastic, glass, or flat extrusion.

Config fields (versioned JSON): `id`, `version`, `description`, `visual_language`,
`form_language`, `material_language`, `lighting_language`, `forbidden`, `sheet`,
`prompt_fragments`.

Resolution order: `StyleConfig.resolve_sheet()` → canonical `sheet` path, then
`sheet_fallbacks`.
