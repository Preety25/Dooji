"""Preserve-constraint prompts for the V4 generative renderer.

Ported from lab/v3/generative/prompts.py patterns. The model is asked to
polish the user's doodle, not replace it. When a style-reference image is
also sent, the prompt names it as IMAGE_1.
"""
from __future__ import annotations

import json


STYLE_COPY = {
    "gummy": (
        "soft inflated gelatin candy, translucent depth, internal volume, "
        "juicy rounded highlights, a few subtle bubbles trapped inside. "
        "Not glass, not metal, not fur."
    ),
    "clay": (
        "matte polymer clay / play-doh, softly sculpted, slight handmade imperfection, "
        "restrained highlights, no gloss coat. Not fur, not glass, not gummy."
    ),
    "plush": (
        "stuffed plush toy with a soft fiber pile and a tactile stitched feel. "
        "Puffy but clearly fabric, not smooth clay and not plastic."
    ),
    "glossy": (
        "smooth hard candy / resin / PVC, crisp controlled highlights, clean premium finish. "
        "Opaque, not translucent gummy, not matte clay, not fur."
    ),
}


def blueprint_summary(bp: dict) -> str:
    lines = [
        f"subject_hypothesis: {bp.get('subject_hypothesis')}",
        f"confidence: {bp.get('confidence')}",
        f"orientation: {bp.get('orientation')}",
        "components:",
    ]
    for c in bp.get("major_components") or []:
        strokes = ",".join(c.get("source_strokes") or []) or "none"
        flag = " completed" if c.get("completed") else ""
        lines.append(f"- {c['id']} ({c.get('name')}): role={c.get('role')} strokes={strokes}{flag}")
    lines.append("relationships:")
    for rel in bp.get("component_relationships") or []:
        if "a" in rel:
            lines.append(f"- {rel.get('type')}: {rel.get('a')} -> {rel.get('b')}. {rel.get('detail','')}")
        else:
            lines.append(f"- {rel.get('type')}: {rel.get('detail','')}")
    lines.append("features_must_preserve:")
    for item in bp.get("features_must_preserve") or []:
        lines.append(f"- {item}")
    lines.append("features_may_complete:")
    for item in bp.get("features_may_complete") or []:
        lines.append(f"- {item}")
    lines.append("features_must_never_invent:")
    for item in bp.get("features_must_never_invent") or []:
        lines.append(f"- {item}")
    return "\n".join(lines)


def build_edit_prompt(bp: dict, style: str, *, multi_image: bool = True) -> str:
    summary = blueprint_summary(bp)
    style_line = STYLE_COPY.get(style, style)
    if multi_image:
        style_block = (
            f"Style: {style}. Match the look of <IMAGE_1> (style reference): {style_line}\n"
            "Use <IMAGE_0> as the doodle to polish; transfer material/look cues from <IMAGE_1> "
            "without copying <IMAGE_1>'s subject silhouette."
        )
    else:
        style_block = f"Style: {style}. {style_line}"
    return (
        "POLISH THE USER'S DOODLE. Do not replace it with a generic object.\n"
        "Edit the provided doodle image into a single centered sticker on a transparent background.\n"
        f"{style_block}\n"
        "\n"
        "Hard preserve constraints:\n"
        "- Keep the subject identity implied by the doodle and the semantic blueprint.\n"
        "- Keep the silhouette, major part count, and part placement.\n"
        "- Keep distinctive proportions and the user's asymmetry. Do not mirror.\n"
        "- Do not remove a meaningful doodle feature.\n"
        "- Do not add arbitrary decoration, text, a background scene, a ground plane, "
        "or a drop shadow.\n"
        "- Do not invent a face, eyes, or a mouth unless the blueprint says those strokes exist.\n"
        "- If confidence is LOW, only clean up the existing strokes. Do not decide they are a star, "
        "animal, or any other object.\n"
        "\n"
        "Semantic blueprint:\n"
        f"{summary}\n"
    )


def build_request(
    bp: dict,
    style: str,
    doodle_png: str,
    *,
    style_ref_png: str | None = None,
    multi_image: bool = True,
) -> dict:
    use_multi = bool(multi_image and style_ref_png)
    prompt = build_edit_prompt(bp, style, multi_image=use_multi)
    req = {
        "style": style,
        "source_id": bp.get("source_id"),
        "doodle_png": doodle_png,
        "style_ref_png": style_ref_png,
        "multi_image": use_multi,
        "prompt": prompt,
        "blueprint_summary": blueprint_summary(bp),
        "negative": [
            "generic replacement object",
            "extra parts not in the blueprint",
            "text",
            "background",
            "ground plane",
            "invented face",
            "melted or fused fins/ears",
        ],
    }
    return req


def dumps_request(req: dict) -> str:
    return json.dumps(req, indent=2)


GUMMY_FIDELITY_STYLE = (
    "Premium soft gummy/gelatin candy material: translucent depth, soft inflated volume, "
    "rich saturated color, subtle internal bubbles, wet controlled highlights, smooth polished "
    "edges, soft studio lighting. "
    "NO ground plane, NO cast shadow, NO background scene, NO visible hard extrusion, "
    "NO plastic toy look, NO jagged edges."
)

SUBJECT_FIDELITY_LINES = {
    "06_rocket": (
        "Subject cue (light naming only): rocket. "
        "Preserve the doodle's actual body, pointed nose, separate left/right fins, and window "
        "placement/count. Polish the user's rocket — do not redesign into a generic NASA rocket."
    ),
    "07_teddy": (
        "Subject cue (light naming only): teddy bear. "
        "Preserve the doodle's actual head, separate ears, body, and any drawn face marks "
        "(eyes only if present). Polish the user's teddy — do not invent snout/mouth/clothing "
        "or replace with a generic teddy."
    ),
    "09_rose": (
        "Subject cue (light naming only): rose/flower. "
        "Interpret as a flower while preserving the user's bloom silhouette, drawn spiral/swirl, "
        "stem, and leaf. Not a photorealistic generic rose petal stack."
    ),
}


def build_fidelity_prompt(
    *,
    source_id: str,
    variant: str,
    blueprint: dict | None = None,
    multi_image: bool = True,
) -> str:
    """Build a doodle-fidelity edit prompt for variant A (raw+gummy) or B (+blueprint text).

    PRIMARY visual source is always the raw doodle (IMAGE_0). Style ref is IMAGE_1 when
    multi_image. Blueprint (variant B) is textual guidance only — never an image.
    """
    variant = variant.upper().strip()
    if variant not in ("A", "B"):
        raise ValueError(f"variant must be A or B, got {variant!r}")

    subject_line = SUBJECT_FIDELITY_LINES.get(
        source_id,
        f"Subject cue from doodle id {source_id}: polish the user's drawing, do not redesign.",
    )

    if multi_image:
        style_block = (
            f"Material / look: match <IMAGE_1> (gummy style reference). {GUMMY_FIDELITY_STYLE}\n"
            "Use <IMAGE_0> as the PRIMARY visual source (the user's raw doodle). "
            "Transfer only material/look cues from <IMAGE_1>; do NOT copy <IMAGE_1>'s "
            "subject silhouette or star shape."
        )
    else:
        style_block = f"Material / look (text-described gummy): {GUMMY_FIDELITY_STYLE}"

    preserve_block = (
        "Product goal: the result must feel like \"my doodle, polished beautifully\" — "
        "NOT a generic AI object.\n"
        "Hard preserve:\n"
        "- Overall silhouette and distinctive proportions from the doodle.\n"
        "- Meaningful component relationships and user-specific asymmetry (do not mirror).\n"
        "- Important features that exist in the original doodle.\n"
        "- Clean up roughness; do not redesign.\n"
        "Do NOT invent:\n"
        "- Decorative elements, text, scenery, unrelated accessories, extra components.\n"
        "- Arbitrary facial features not present in the doodle.\n"
        "- Background scene, ground plane, or cast/drop shadow.\n"
    )

    parts = [
        "POLISH THE USER'S DOODLE. Do not replace it with a generic object.",
        "Edit into a single centered sticker on a transparent / empty studio background.",
        style_block,
        "",
        subject_line,
        "",
        preserve_block,
    ]

    if variant == "B":
        if blueprint is None:
            raise ValueError("variant B requires blueprint dict for textual guidance")
        summary = blueprint_summary(blueprint)
        parts.extend(
            [
                "",
                "Semantic blueprint (TEXT guidance only — structure hints; the doodle remains "
                "the visual source of truth):\n"
                f"{summary}",
            ]
        )
    # Variant A: explicitly no blueprint summary
    return "\n".join(parts).rstrip() + "\n"


# --- V4.1 Jelly-Gummy fidelity + delight ---------------------------------

JELLY_GUMMY_STYLE = (
    "Playful juicy soft inflated tactile translucent candy/jelly material with rich internal "
    "volume, subtle trapped bubbles, wet controlled highlights, colorful slightly exaggerated "
    "forms, premium toy/candy/3D-illustration feel. Delightful 3D sticker/object presentation — "
    "NOT a photoreal food photo, NOT a grocery-product shot. Allow delight in softness, volume, "
    "highlights, material, color, bubbles, and subtle perspective. "
    "Do NOT invent identity, silhouette, structure, or component count."
)


def build_jelly_gummy_style_block(*, multi_image: bool = True, n_style_refs: int = 2) -> str:
    """Describe Jelly-Gummy look; names IMAGE_1.. when multi-image style refs are attached."""
    if multi_image and n_style_refs >= 2:
        return (
            "Material / look: match <IMAGE_1> and <IMAGE_2> (Jelly-Gummy style references). "
            f"{JELLY_GUMMY_STYLE}\n"
            "Use <IMAGE_0> as the PRIMARY visual source (the user's raw doodle). "
            "Transfer only material/look/presentation cues from the style refs; do NOT copy "
            "the style refs' subject silhouettes or identities."
        )
    if multi_image and n_style_refs == 1:
        return (
            "Material / look: match <IMAGE_1> (Jelly-Gummy style reference). "
            f"{JELLY_GUMMY_STYLE}\n"
            "Use <IMAGE_0> as the PRIMARY visual source (the user's raw doodle). "
            "Transfer only material/look/presentation cues from <IMAGE_1>; do NOT copy "
            "<IMAGE_1>'s subject silhouette or identity."
        )
    return f"Material / look (text-described Jelly-Gummy): {JELLY_GUMMY_STYLE}"


SUBJECT_V41_LINES = {
    "06_rocket": (
        "Subject cue (light naming only): rocket. "
        "Preserve the doodle's actual body, pointed nose, separate left/right fins, and window "
        "placement/count. Polish the user's rocket — do not redesign into a generic NASA rocket. "
        "Do NOT add flame or exhaust (not drawn)."
    ),
    "07_teddy": (
        "Subject cue (light naming only): teddy bear. "
        "Preserve the doodle's actual head, separate ears, body, and any drawn face marks "
        "(eyes only if present). Polish the user's teddy — do not invent snout/mouth/limbs/"
        "arms/legs/clothing or replace with a generic teddy."
    ),
}


def build_fidelity_v41_prompt(
    *,
    variant: str,
    source_id: str,
    strict_bp: dict | None = None,
    multi_image: bool = True,
    n_style_refs: int = 2,
) -> str:
    """V4.1 Jelly-Gummy fidelity prompt.

    Variant A: raw doodle + Jelly-Gummy style refs only (NO semantic blueprint text).
    Variant B: raw doodle + STRICT four-field constraints + Jelly-Gummy style refs.
    Never injects features_may_complete / old permissive blueprint text.
    """
    from lab.v4.strict_blueprint import strict_summary_for_prompt

    variant = variant.upper().strip()
    if variant not in ("A", "B"):
        raise ValueError(f"variant must be A or B, got {variant!r}")

    subject_line = SUBJECT_V41_LINES.get(
        source_id,
        f"Subject cue from doodle id {source_id}: polish the user's drawing, do not redesign.",
    )
    style_block = build_jelly_gummy_style_block(
        multi_image=multi_image, n_style_refs=n_style_refs
    )

    preserve_block = (
        'Core principle: "Understand what I drew, then make MY version beautiful."\n'
        "Conservative on: identity, silhouette, structure, component count, proportions, "
        "user asymmetry.\n"
        "Expressive on: material, lighting, volume, surface, translucency, micro-detail, "
        "presentation.\n"
        "\n"
        "Hard preserve:\n"
        "- Overall silhouette and distinctive proportions from the doodle.\n"
        "- Meaningful component relationships and user-specific asymmetry (do not mirror).\n"
        "- Important features that exist in the original doodle only.\n"
        "- Clean up roughness; do not redesign.\n"
        "Do NOT invent:\n"
        "- Decorative elements, text, scenery, unrelated accessories, extra components.\n"
        "- Arbitrary facial features, limbs, or parts not present in the doodle.\n"
        "- Background scene, ground plane, or cast/drop shadow.\n"
    )

    parts = [
        "POLISH THE USER'S DOODLE. Do not replace it with a generic object.",
        "Edit into a single centered sticker on a transparent / empty studio background.",
        style_block,
        "",
        subject_line,
        "",
        preserve_block,
    ]

    if variant == "B":
        if strict_bp is None:
            raise ValueError("variant B requires strict_bp (four-field strict blueprint)")
        summary = strict_summary_for_prompt(strict_bp)
        parts.extend(
            [
                "",
                "STRICT semantic constraints (TEXT only — four fields; doodle remains visual "
                "source of truth). Do NOT treat inferred_components as permission to invent "
                "geometry. allowed_completion is empty or very tight. forbidden_additions are "
                "hard bans.\n"
                f"{summary}",
            ]
        )
    # Variant A: explicitly no semantic blueprint text
    return "\n".join(parts).rstrip() + "\n"


# --- V4.2 unseen pack: stylized-dimensionality gummy ---

V42_GUMMY_STYLIZED_DIM = (
    "STYLIZED 3D dimensionality — exaggerated soft inflated sculpted toy / sticker / candy-object. "
    "Aggressive volume, softness, material richness, and charm. "
    "Translucent gelatin gummy with internal color depth, embedded micro-bubbles, wet rounded "
    "highlights, soft internal glow, squishy tactile candy feel. "
    "NOT a photoreal food photo, NOT a grocery product shot, NOT hard plastic, NOT a flat 2.5D "
    "extruded slab, NOT a mechanical CAD extrusion, NOT clay, NOT plush, NOT hard glossy resin."
)


def build_v42_unseen_gummy_prompt(
    recognition: dict,
    *,
    multi_image: bool = True,
    n_style_refs: int = 2,
) -> str:
    """Strict recognition-driven gummy prompt for V4.2 unseen pack (stylized dimensionality)."""
    sid = recognition.get("id", "?")
    hyp = recognition.get("subject_hypothesis", "unknown subject")
    conf = recognition.get("confidence", 0.0)
    observed = recognition.get("observed_components") or []
    inferred = recognition.get("inferred_components") or []
    allowed = recognition.get("allowed_completion") or []
    forbidden = recognition.get("forbidden_additions") or []
    color_notes = recognition.get("color_notes")

    if multi_image and n_style_refs >= 2:
        style_block = (
            "PRIMARY = <IMAGE_0> (the user's doodle — visual source of truth). "
            "<IMAGE_1> and <IMAGE_2> are Jelly-Gummy style references for FORM/MATERIAL ONLY — "
            "do NOT copy their rocket or flower identity, silhouette, or subject.\n"
            f"Material / look: {V42_GUMMY_STYLIZED_DIM}"
        )
    elif multi_image and n_style_refs == 1:
        style_block = (
            "PRIMARY = <IMAGE_0> (the user's doodle — visual source of truth). "
            "<IMAGE_1> is a Jelly-Gummy style reference for FORM/MATERIAL ONLY — "
            "do NOT copy its subject identity or silhouette.\n"
            f"Material / look: {V42_GUMMY_STYLIZED_DIM}"
        )
    else:
        style_block = f"Material / look (text-described): {V42_GUMMY_STYLIZED_DIM}"

    def _bullets(items):
        if not items:
            return "- (none)"
        return "\n".join(f"- {x}" for x in items)

    low_conf_extra = ""
    if float(conf) < 0.75 or "zigzag" in str(hyp).lower() or sid == "u06":
        low_conf_extra = (
            "\nLOW-CONFIDENCE RULE: Do NOT reinvent as a different object (no snake/dragon/face). "
            "Keep a soft translucent gummy ribbon/tube that faithfully follows the drawn zigzag path "
            "and peak count. Preserve the green color family.\n"
        )

    color_line = ""
    if color_notes:
        color_line = f"\nColor family: {color_notes}. Preserve the doodle's color family if colored.\n"

    return (
        'Core: "Understand what I drew, then make MY version beautiful."\n'
        "POLISH THE USER'S DOODLE into a single centered isolated gummy candy-object / sticker.\n"
        "Clean presentation on transparent or pure white void. No scene, floor, ground, text, "
        "drop shadow, or environment.\n"
        f"{style_block}\n"
        "\n"
        "Recognition (STRICT — encode and obey these fields):\n"
        f"subject_hypothesis: {hyp}\n"
        f"confidence: {conf}\n"
        f"observed_components:\n{_bullets(observed)}\n"
        f"inferred_components (volume/material hints ONLY — not permission to invent geometry):\n"
        f"{_bullets(inferred)}\n"
        f"allowed_completion:\n{_bullets(allowed)}\n"
        f"forbidden_additions (HARD BANS):\n{_bullets(forbidden)}\n"
        f"{color_line}"
        f"{low_conf_extra}"
        "\n"
        "Hard preserve (doodle fidelity / authorship):\n"
        "- Absolute object identity from the doodle.\n"
        "- Silhouette, proportions, component count, asymmetry, quirks.\n"
        "- Color family if the doodle is colored.\n"
        "- Delight comes from volume/material ONLY — do NOT add eyes, mouths, limbs, or decor "
        "unless those marks are observed in the doodle.\n"
        "\n"
        "Stylized dimensionality (push hard):\n"
        "- Inflated soft sculpted toy/sticker/candy-object with exaggerated plump volume.\n"
        "- Soft rounded forms, squishy gelatin, internal glow, wet candy highlights, bubbles.\n"
        "- Prefer charming stylized 3D illustration over photorealism.\n"
    )


# --- V4.3 multi-style transform (shared family + 4 styles) -----------------

V43_NORTH_STAR = (
    'Core: "Draw something messy. We understand what you meant and make YOUR version beautiful."'
)

V43_ELASTIC_FIDELITY = (
    "ELASTIC FIDELITY:\n"
    "Improve execution aggressively; preserve idea conservatively.\n"
    "OK: smooth contours; improve symmetry/proportion/alignment/spacing/curvature; "
    "clean noise; make dimensional/plump/toy-like; rich material finish.\n"
    "NOT OK: replace with a generic category object; invent major unsupported parts "
    "(extra fins/windows/limbs/faces/accessories); change identity or component count; "
    "copy style-sheet subjects/poses/faces."
)

V43_STYLIZED_DIM = (
    "STYLIZED DIMENSIONALITY (all styles): premium 3D sticker / designer toy / soft sculpture / "
    "candy illustration — plump charming volume. "
    "NOT photoreal, NOT product photo, NOT CAD extrusion, NOT flat bevel slab, NOT scene/floor/text."
)

V43_STYLE_LOOK = {
    "gummy": (
        "GUMMY material: juicy soft inflated translucent gelatin candy; internal color depth; "
        "suspended micro-bubbles; wet rounded highlights; luminous soft edges; squishy tactile feel. "
        "NOT glass/acrylic, NOT photoreal food, NOT hard opaque resin, NOT clay, NOT plush."
    ),
    "clay": (
        "CLAY material: soft-sculpted matte polymer clay / play-doh; puffy handmade; subtle surface "
        "variation; restrained warm diffuse highlights; opaque soft body. "
        "NOT translucent gummy, NOT dirty/crumbly earth photo, NOT ceramic glaze photo, "
        "NOT fuzzy plush, NOT clearcoat plastic."
    ),
    "plush": (
        "PLUSH material: stylized soft stuffed designer toy / short-pile felted soft sculpture; "
        "simplified puffy volume; subtle controlled fabric nap; soft compression. "
        "NOT photoreal fur, NOT long individual hairs, NOT smooth clay, NOT glossy plastic, "
        "NOT translucent jelly, NOT hard vinyl."
    ),
    "glossy": (
        "GLOSSY material: SOLID opaque polished resin / lacquered vinyl / hard-candy toy "
        "(NOT translucent jelly/gummy); rich saturated color; crisp clearcoat specular highlights; "
        "hard polished toy finish. NOT gummy transparency, NOT metal/glass/ceramic product photo, "
        "NOT matte clay, NOT fuzzy plush."
    ),
}

V43_STYLE_SHEET_NOTE = {
    "gummy": (
        "PRIMARY = <IMAGE_0> (user doodle — visual source of truth). "
        "Additional image(s) are GUMMY STYLE SHEETS for visual language / material ONLY — "
        "never copy sheet objects, poses, faces, or silhouettes."
    ),
    "clay": (
        "PRIMARY = <IMAGE_0> (user doodle — visual source of truth). "
        "<IMAGE_1> is a CLAY STYLE SHEET for visual language / material ONLY — "
        "never copy sheet objects, poses, faces, or silhouettes."
    ),
    "plush": (
        "PRIMARY = <IMAGE_0> (user doodle — visual source of truth). "
        "<IMAGE_1> is a PLUSH STYLE SHEET for visual language / material ONLY — "
        "never copy sheet objects, poses, faces, or silhouettes."
    ),
    "glossy": (
        "PRIMARY = <IMAGE_0> (user doodle — visual source of truth). "
        "<IMAGE_1> is the GLOSSY STYLE SHEET (solid polished resin/vinyl/hard-candy toy with "
        "sharp clearcoat speculars) for visual language / material ONLY — never copy sheet "
        "objects, poses, faces, or silhouettes. Stay SOLID opaque; do NOT become translucent jelly."
    ),
}


def build_v43_multi_style_prompt(
    recognition: dict,
    style: str,
    *,
    multi_image: bool = True,
    n_style_refs: int = 1,
) -> str:
    """V4.3 elastic-fidelity + style-specific prompt. Same recognition for all styles."""
    style = style.lower().strip()
    if style not in V43_STYLE_LOOK:
        raise ValueError(f"unknown style {style!r}; expected one of {sorted(V43_STYLE_LOOK)}")

    sid = recognition.get("id", "?")
    hyp = recognition.get("subject_hypothesis", "unknown subject")
    conf = recognition.get("confidence", 0.0)
    observed = recognition.get("observed_components") or []
    inferred = recognition.get("inferred_components") or []
    allowed = recognition.get("allowed_completion") or []
    forbidden = recognition.get("forbidden_additions") or []
    color_notes = recognition.get("color_notes")

    look = V43_STYLE_LOOK[style]

    if not multi_image or n_style_refs <= 0:
        style_header = (
            "PRIMARY = <IMAGE_0> (user doodle). Style described in text only. "
            + V43_STYLE_LOOK[style]
        )
    elif style == "gummy" and n_style_refs >= 2:
        style_header = (
            V43_STYLE_SHEET_NOTE["gummy"]
            + " <IMAGE_1> and <IMAGE_2> are gummy style sheets."
        )
    elif style in ("gummy", "clay", "plush", "glossy"):
        style_header = V43_STYLE_SHEET_NOTE[style]
        if style == "gummy":
            style_header = (
                V43_STYLE_SHEET_NOTE["gummy"] + " <IMAGE_1> is the primary gummy style sheet."
            )
    else:
        style_header = V43_STYLE_SHEET_NOTE[style]

    def _bullets(items):
        if not items:
            return "- (none)"
        return "\n".join(f"- {x}" for x in items)

    low_conf_extra = ""
    if float(conf) < 0.75 or "zigzag" in str(hyp).lower() or sid == "u06":
        low_conf_extra = (
            "\nLOW-CONFIDENCE RULE: Do NOT reinvent as a different object "
            "(no snake/dragon/face). Keep a soft tubular ribbon that faithfully follows "
            "the drawn zigzag path and peak count. Preserve the green color family.\n"
        )

    color_line = ""
    if color_notes:
        color_line = f"\nColor family: {color_notes}. Preserve the doodle's color family if colored.\n"

    return (
        f"{V43_NORTH_STAR}\n"
        f"POLISH THE USER'S DOODLE into a single centered isolated {style} toy/sticker object.\n"
        "Clean presentation on transparent or pure empty void. No scene, floor, ground, text, "
        "drop shadow, or environment.\n"
        f"{style_header}\n"
        f"Material / look: {look}\n"
        f"{V43_STYLIZED_DIM}\n"
        "\n"
        f"{V43_ELASTIC_FIDELITY}\n"
        "\n"
        "Recognition (STRICT — same semantics for every style; encode and obey):\n"
        f"subject_hypothesis: {hyp}\n"
        f"confidence: {conf}\n"
        f"observed_components:\n{_bullets(observed)}\n"
        f"inferred_components (volume/material hints ONLY — not permission to invent geometry):\n"
        f"{_bullets(inferred)}\n"
        f"allowed_completion:\n{_bullets(allowed)}\n"
        f"forbidden_additions (HARD BANS):\n{_bullets(forbidden)}\n"
        f"{color_line}"
        f"{low_conf_extra}"
        "\n"
        "Hard preserve (doodle fidelity / authorship):\n"
        "- Absolute object identity from the doodle.\n"
        "- Silhouette, proportions, component count, asymmetry, quirks.\n"
        "- Color family if the doodle is colored.\n"
        "- Delight comes from volume/material ONLY — do NOT add eyes, mouths, limbs, or decor "
        "unless those marks are observed in the doodle.\n"
        "\n"
        f"Style separation: this output must read unmistakably as {style.upper()} — "
        "not the other three styles.\n"
    )


# --- V4.4 semantic parsing + style guardrails -----------------------------

V44_NORTH_STAR = (
    'Core: "Draw something messy. Dooji understands what you meant, cleans it up, '
    'and makes YOUR version beautiful." '
    "Preserve the decisions, not the mistakes."
)

V44_PRIORITY = (
    "PRIORITY HIERARCHY (binding — lower never overrides higher):\n"
    "1) creative intent from the doodle (identity, expression, pose, orientation, "
    "distinctive features)  2) stroke-role / structural analysis  "
    "3) semantic reconstruction  4) transform rules  5) style reference  "
    "6) generative creativity.\n"
    "Exact stroke geometry is NOT a top priority — reconstruct poor execution freely."
)

V44_ELASTIC = (
    "INTENT-PRESERVING RECONSTRUCTION: treat the doodle as a rough design sketch, "
    "not finished geometry. Reconstruct cleanly; polish aggressively; then stylize hard.\n"
    "Similarity is semantic, expressive, and compositional — NOT pixel- or stroke-level.\n"
    "OK: substantial geometry reconstruction; smooth/regularize contours; repair joins; "
    "close obvious gaps; rebuild malformed appendages; improve proportion/alignment when "
    "it clarifies intent; dimensional/plump/toy-like volume; rich material finish.\n"
    "NOT OK: replace identity; invent unsupported parts/faces/accessories; casually change "
    "expression/pose/orientation; copy style-sheet subjects/poses/faces/palette; "
    "merely inflate/trace rough strokes; treat interior marks as independent floating objects; "
    "turn the result into a generic canonical stock object."
)

V44_STYLIZED_DIM = (
    "STYLIZED DIMENSIONALITY: premium 3D sticker / designer toy / soft sculpture / "
    "candy illustration — plump charming volume. "
    "NOT photoreal, NOT product photo, NOT CAD extrusion, NOT flat bevel slab, "
    "NOT scene/floor/text, NOT photographic fur."
)

V44_STYLE_LOOK = {
    "gummy": (
        "GUMMY material ONLY: juicy soft inflated translucent gelatin candy; internal color "
        "depth; suspended micro-bubbles; wet rounded highlights; luminous soft edges. "
        "NOT glass, NOT hard opaque resin, NOT clay, NOT plush."
    ),
    "clay": (
        "CLAY material ONLY: soft-sculpted matte polymer clay / play-doh; puffy handmade; "
        "subtle surface variation; restrained warm diffuse highlights; opaque soft body. "
        "NOT translucent gummy, NOT fuzzy plush, NOT clearcoat plastic, NOT ceramic photo."
    ),
    "plush": (
        "PLUSH material ONLY: stylized soft stuffed designer toy / short-pile felted soft "
        "sculpture; simplified puffy volume; subtle controlled fabric nap; soft compression; "
        "matte cozy lighting. NOT photoreal fur, NOT long individual hairs, NOT extreme fiber "
        "detail, NOT animal photography, NOT smooth clay, NOT glossy plastic, NOT jelly."
    ),
    "glossy": (
        "GLOSSY material ONLY: SOLID opaque polished resin / lacquered vinyl / hard-candy toy "
        "(NOT translucent jelly); rich saturated color; crisp clearcoat specular highlights; "
        "hard polished toy finish. NOT gummy transparency, NOT metal/glass product photo, "
        "NOT matte clay, NOT fuzzy plush."
    ),
}

V44_GLOSSY_HARD_RULE = (
    "GLOSSY HARD RULE (non-negotiable):\n"
    "Always fully reconstruct as a SOLID opaque polished resin/vinyl object.\n"
    "Pipeline: fill closed regions → make volumetric → apply clearcoat speculars.\n"
    "NEVER wireframe / outline / line sculpture / gray extruded line / hollow contour / "
    "tube drawing / unfilled stroke paths. If the doodle is line art, you must still "
    "produce a filled solid toy — not a 3D stroke extrusion."
)

V44_STYLE_REF_ANTI_COPY = (
    "STYLE SHEET = MATERIAL ONLY (HARD):\n"
    "The style-reference image teaches ONLY form language, material, lighting, surface, "
    "dimensionality, and personality of the FINISH.\n"
    "Do NOT copy from the style sheet: subject identity, component count, pose, faces, "
    "palette assignment, decorative objects, rainbow/multicolor candy colors, or any "
    "sheet object silhouette.\n"
    "Style sheet is MATERIAL ONLY; do not copy any subject/object/colors from the "
    "reference sheet onto the user's doodle."
)


def build_v44_semantic_prompt(
    recognition: dict,
    style: str,
    *,
    multi_image: bool = True,
    n_style_refs: int = 1,
) -> str:
    """V4.4 prompt: semantic lock + stroke roles + face/color/glossy guardrails."""
    from lab.v4.stroke_roles import (
        interior_mark_instruction,
        open_stroke_instruction,
        stroke_roles_prompt_block,
        broken_contour_instruction,
    )

    style = style.lower().strip()
    if style not in V44_STYLE_LOOK:
        raise ValueError(f"unknown style {style!r}; expected one of {sorted(V44_STYLE_LOOK)}")

    sid = recognition.get("id", "?")
    hyp = recognition.get("subject_hypothesis", "unknown subject")
    conf = recognition.get("confidence", 0.0)
    observed = recognition.get("observed_components") or []
    inferred = recognition.get("inferred_components") or []
    allowed = recognition.get("allowed_completion") or []
    forbidden = recognition.get("forbidden_additions") or []
    faces_observed = bool(recognition.get("faces_observed", False))
    face_policy = recognition.get("face_policy") or (
        "Invent eyes/mouth/cheeks/blush ONLY if the doodle has them."
    )
    color_lock = recognition.get("color_lock") or {}
    identity_lock = recognition.get("identity_lock")
    glossy_extra = recognition.get("glossy_construction")
    stroke_roles = recognition.get("stroke_roles") or []

    def _bullets(items):
        if not items:
            return "- (none)"
        return "\n".join(f"- {x}" for x in items)

    if multi_image and n_style_refs >= 1:
        style_header = (
            f"PRIMARY = <IMAGE_0> (user doodle — visual + semantic source of truth).\n"
            f"<IMAGE_1> is the {style.upper()} STYLE SHEET.\n"
            f"{V44_STYLE_REF_ANTI_COPY}"
        )
    else:
        style_header = (
            "PRIMARY = <IMAGE_0> (user doodle). Style described in text only.\n"
            + V44_STYLE_REF_ANTI_COPY
        )

    face_block = (
        f"FACE POLICY (semantic, not style): faces_observed={faces_observed}.\n"
        f"{face_policy}\n"
        "Faces are SEMANTIC not style: invent eyes/mouth/cheeks/blush ONLY if doodle has them."
    )
    if not faces_observed:
        face_block += (
            "\nHARD BAN for this doodle: no eyes, no mouth, no cheeks, no blush, no kawaii face."
        )

    color_notes = color_lock.get("notes") or recognition.get("color_notes") or ""
    color_rels = color_lock.get("preserve_relationships") or []
    color_block = (
        "COLOR LOCK:\n"
        "- Preserve the user's important color relationships from the doodle.\n"
        "- Enriching saturation/depth is OK.\n"
        "- Do NOT import style-sheet palettes (no rainbow / RGB candy colors from glossy sheet).\n"
    )
    if color_notes:
        color_block += f"- Notes: {color_notes}\n"
    if color_rels:
        color_block += "Preserve relationships:\n" + _bullets(color_rels) + "\n"

    identity_block = ""
    if identity_lock:
        identity_block = f"\nIDENTITY LOCK:\n{identity_lock}\n"

    glossy_block = ""
    if style == "glossy":
        glossy_block = f"\n{V44_GLOSSY_HARD_RULE}\n"
        if glossy_extra:
            glossy_block += f"Doodle-specific glossy note: {glossy_extra}\n"

    stroke_block = ""
    if stroke_roles:
        stroke_block = "\n" + stroke_roles_prompt_block(stroke_roles, style) + "\n"
    else:
        stroke_block = (
            "\n"
            + interior_mark_instruction(style)
            + "\n"
            + broken_contour_instruction()
            + "\n"
            + open_stroke_instruction()
            + "\n"
        )

    # Special attention lines for known failure modes
    special = ""
    if sid == "u06":
        special = (
            "\nSPECIAL (u06): The green zigzag is an INTERIOR SURFACE MARK ON THE MUG body — "
            "NOT an independent green ribbon/tube/grass. Embed/paint/mold it onto the mug "
            f"material ({style}).\n"
        )
    elif sid == "u07":
        special = (
            "\nSPECIAL (u07): MUST remain a hat-person. Style sheets (esp. clay) contain "
            "flowers — IGNORE flower subjects. Wide loops = hat brim; keep person body.\n"
        )
    elif sid == "u03" and style == "glossy":
        special = (
            "\nSPECIAL (u03/glossy): MUST be a solid polished volumetric head — "
            "NO gray wire / extruded outline sculpture.\n"
        )
    elif sid == "u01" and style == "plush":
        special = (
            "\nSPECIAL (u01/plush): MUST NOT invent a face. Mug + steam only. "
            "No eyes/mouth/blush.\n"
        )
    elif sid == "u08" and style == "glossy":
        special = (
            "\nSPECIAL (u08/glossy): MUST NOT import RGB/multicolor sheet palette onto the "
            "three tops. Coherent plant colors only.\n"
        )

    return (
        f"{V44_NORTH_STAR}\n"
        f"POLISH THE USER'S DOODLE into a single centered isolated {style} toy/sticker object.\n"
        "Clean presentation on transparent or pure empty void. No scene, floor, ground, text, "
        "drop shadow, or environment.\n"
        f"{style_header}\n"
        f"Material / look: {V44_STYLE_LOOK[style]}\n"
        f"{V44_STYLIZED_DIM}\n"
        "\n"
        f"{V44_PRIORITY}\n"
        f"{V44_ELASTIC}\n"
        f"{identity_block}"
        f"{glossy_block}"
        f"{stroke_block}"
        "\n"
        "Semantic lock (recognized ONCE — same identity for all 4 styles):\n"
        f"subject_hypothesis: {hyp}\n"
        f"confidence: {conf}\n"
        f"observed_components:\n{_bullets(observed)}\n"
        f"inferred_components (volume/material hints ONLY — not invent permission):\n"
        f"{_bullets(inferred)}\n"
        f"allowed_completion:\n{_bullets(allowed)}\n"
        f"forbidden_additions (HARD BANS):\n{_bullets(forbidden)}\n"
        "\n"
        f"{face_block}\n"
        "\n"
        f"{color_block}"
        f"{special}"
        "\n"
        "Creative anchors to preserve (VERY STRONG):\n"
        "- Absolute object identity from the doodle + semantic lock.\n"
        "- Expression, pose, orientation, major proportions, distinctive features.\n"
        "- Intentional asymmetry and quirks — not stroke wobble or jagged contours.\n"
        "Free to change: exact stroke paths, malformed joins, accidental gaps, "
        "uneven thickness, bad circles, drawing artifacts.\n"
        "Interior marks stay on parent surfaces; meaningful open strokes stay open "
        "(clean their execution).\n"
        "Delight from reconstruction + volume/material — never from inventing identity "
        "or unsupported faces.\n"
        "\n"
        f"Style separation: this output must read unmistakably as {style.upper()} — "
        "not the other three styles. Apply style aggressively after reconstruction.\n"
    )
