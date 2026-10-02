"""Production prompt compiler — Intent-Preserving Stylized Reconstruction (spec v1.2).

Doctrine: Preserve the decisions, not the mistakes.
Doodle image = rough design sketch (creative anchors). Style sheets = material language only.
"""
from __future__ import annotations

from typing import Any

from lab.v4.generative.prompts import (
    V44_ELASTIC,
    V44_GLOSSY_HARD_RULE,
    V44_NORTH_STAR,
    V44_PRIORITY,
    V44_STYLE_REF_ANTI_COPY,
    V44_STYLIZED_DIM,
)
from lab.v4.stroke_roles import (
    broken_contour_instruction,
    interior_mark_instruction,
    open_stroke_instruction,
    stroke_roles_prompt_block,
)
from product.transform.styles import StyleConfig

# Product-facing reconstruction doctrine (extends V4.4; never returned to mobile).
# Spec: docs/spec-v1.2/DOOJI-TRANSFORMAT-SPEC.md
EXECUTION_DOCTRINE = (
    'Preserve the decisions, not the mistakes.\n'
    "Treat the input doodle as a rough design sketch, not finished geometry. "
    "First understand the intended subject and identify its important creative anchors: "
    "identity, expression, pose, orientation, major proportions, and distinctive features. "
    "Reconstruct the object cleanly and coherently. Smooth rough contours, repair malformed "
    "joins, close obvious gaps, simplify accidental marks, and replace poor drawing execution "
    "with polished geometry. Preserve the user's intended expression, pose, angle, proportions, "
    "and distinctive characteristics. Do not reproduce drawing imperfections merely because "
    "they are present in the source. After reconstruction, apply the requested stylized 3D "
    "material aggressively and beautifully.\n"
    "Similarity is semantic and expressive, not pixel- or stroke-level.\n"
    "Do not turn the result into a generic canonical version of the subject.\n"
    "ALLOWED: substantial geometry reconstruction (Level 0–2); smooth/regularize contours; "
    "improve symmetry/proportion/alignment when it clarifies intent; close structural gaps; "
    "rebuild malformed appendages; establish coherent volume; enrich dimensionality and "
    "material polish; make it plump / toy-like.\n"
    "FORBIDDEN: replace the object with a generic category item; invent unsupported "
    "components, limbs, accessories, or decorations; change expression/pose/orientation "
    "casually; auto-add faces unless clearly drawn or strongly cue-supported; "
    "copy style-sheet subjects, poses, faces, or palette assignment; "
    "merely inflate/trace rough strokes without cleaning them."
)


def default_recognition(*, client_doodle_id: str | None = None) -> dict[str, Any]:
    """Minimal recognition when no VLM / lock is available yet.

    MVP does not block on full auto recognition. The doodle PNG is the primary
    creative-intent signal; this lock is a reconstruction scaffold. Existing
    stroke-role / recognition infra is used when a richer lock is supplied via
    options.recognition (tests / future VLM) — never a hand-curated mobile recognizer.
    """
    return {
        "id": client_doodle_id or "anonymous",
        "subject_hypothesis": (
            "user doodle (preserve creative anchors; reconstruct poor execution)"
        ),
        "confidence": 0.0,
        "observed_components": [
            "all strokes and closed regions visible in the doodle PNG",
        ],
        "inferred_components": [
            "soft volume / material thickness consistent with chosen style (hint only)",
        ],
        "allowed_completion": [
            "smooth and reconstruct rough contours (do not merely inflate wobble)",
            "repair malformed joins and close obvious structural gaps",
            "regularize bad circles / jagged edges into clean rounded forms",
            "rebuild strongly implied structure needed for a coherent subject (Level 2)",
            "improve proportion / alignment / curvature while preserving distinctive quirks",
            "establish coherent dimensional volume after reconstruction",
        ],
        "forbidden_additions": [
            "invented face features unless drawn or strongly cue-supported",
            "extra limbs / accessories not in the doodle",
            "second subject or scene elements",
            "copying style-sheet objects or palette",
            "replacing the doodle with a generic category / stock object",
            "changing subject identity, expression, pose, or orientation",
        ],
        "faces_observed": False,
        "face_policy": (
            "If facial marks are present, preserve emotional intent and relationships "
            "while polishing execution — do not literally reproduce malformed marks. "
            "Invent eyes/mouth/cheeks/blush ONLY if the doodle clearly has them or "
            "partial cues strongly support limited completion. Default: no face."
        ),
        "color_lock": {
            "notes": "Preserve important doodle color relationships; enrich depth OK.",
            "preserve_relationships": [],
        },
        "stroke_roles": [],
    }


def compile_prompt(
    *,
    style: StyleConfig,
    recognition: dict[str, Any],
    multi_image: bool = True,
    n_style_refs: int = 1,
) -> str:
    """Compile server-side edit prompt. Never returned to mobile clients."""
    style_id = style.id
    hyp = recognition.get("subject_hypothesis", "unknown subject")
    conf = recognition.get("confidence", 0.0)
    observed = recognition.get("observed_components") or []
    inferred = recognition.get("inferred_components") or []
    allowed = recognition.get("allowed_completion") or []
    forbidden = list(recognition.get("forbidden_additions") or [])
    # Merge style-level forbidden into recognition bans
    for item in style.forbidden:
        if item not in forbidden:
            forbidden.append(item)

    faces_observed = bool(recognition.get("faces_observed", False))
    face_policy = recognition.get("face_policy") or (
        "Invent eyes/mouth/cheeks/blush ONLY if the doodle has them."
    )
    color_lock = recognition.get("color_lock") or {}
    identity_lock = recognition.get("identity_lock")
    glossy_extra = recognition.get("glossy_construction")
    stroke_roles = recognition.get("stroke_roles") or []

    def _bullets(items: list) -> str:
        if not items:
            return "- (none)"
        return "\n".join(f"- {x}" for x in items)

    if multi_image and n_style_refs >= 1:
        style_header = (
            f"PRIMARY = <IMAGE_0> (user doodle — rough design sketch; creative-intent source).\n"
            f"<IMAGE_1> is the {style_id.upper()} STYLE SHEET (material language only).\n"
            f"{V44_STYLE_REF_ANTI_COPY}"
        )
    else:
        style_header = (
            "PRIMARY = <IMAGE_0> (user doodle — rough design sketch). "
            "Style described in text only.\n"
            + V44_STYLE_REF_ANTI_COPY
        )

    face_block = (
        f"FACE POLICY (semantic, not style): faces_observed={faces_observed}.\n"
        f"{face_policy}\n"
        "Faces are SEMANTIC not style: preserve expression intent; polish execution; "
        "invent eyes/mouth/cheeks/blush ONLY if doodle has them or cues strongly support it."
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
        "- Do NOT import style-sheet palettes.\n"
    )
    if color_notes:
        color_block += f"- Notes: {color_notes}\n"
    if color_rels:
        color_block += "Preserve relationships:\n" + _bullets(color_rels) + "\n"

    identity_block = f"\nIDENTITY LOCK:\n{identity_lock}\n" if identity_lock else ""

    glossy_block = ""
    if style_id == "glossy":
        glossy_block = f"\n{V44_GLOSSY_HARD_RULE}\n"
        if glossy_extra:
            glossy_block += f"Doodle-specific glossy note: {glossy_extra}\n"
        frag = style.prompt_fragments.get("hard_rule")
        if frag:
            glossy_block += frag + "\n"

    style_hard_block = ""
    if style_id != "glossy":
        frag = style.prompt_fragments.get("hard_rule")
        if frag:
            style_hard_block = f"\n{frag}\n"

    if stroke_roles:
        stroke_block = "\n" + stroke_roles_prompt_block(stroke_roles, style_id) + "\n"
    else:
        stroke_block = (
            "\n"
            + interior_mark_instruction(style_id)
            + "\n"
            + broken_contour_instruction()
            + "\n"
            + open_stroke_instruction()
            + "\n"
        )

    look = style.look_line
    extra = style.prompt_fragments.get("extra") or ""
    style_ver = getattr(style, "version", "") or ""

    return (
        f"{V44_NORTH_STAR}\n"
        f"{EXECUTION_DOCTRINE}\n"
        f"RECONSTRUCT AND STYLIZE THE USER'S DOODLE into a single centered isolated "
        f"{style_id} toy/sticker object.\n"
        "The doodle image communicates creative intent — reconstruct cleanly; "
        "do not merely trace or inflate rough strokes.\n"
        "PRESENTATION (binding): TRUE transparent cutout (alpha PNG). "
        "NEVER a white/gray/colored rectangular backdrop, NEVER studio seamless paper, "
        "NEVER ground plane, NEVER cast-shadow scene, NEVER environment/text. "
        "Isolated designer-toy sticker only.\n"
        f"{style_header}\n"
        f"Style pack: {style_id} v{style_ver}\n"
        f"Material / look: {look}\n"
        f"{V44_STYLIZED_DIM}\n"
        f"{extra}\n"
        f"{V44_PRIORITY}\n"
        f"{V44_ELASTIC}\n"
        f"{identity_block}"
        f"{glossy_block}"
        f"{style_hard_block}"
        f"{stroke_block}"
        "\n"
        "Semantic lock (recognized ONCE — same identity for all styles):\n"
        f"subject_hypothesis: {hyp}\n"
        f"confidence: {conf}\n"
        f"observed_components:\n{_bullets(observed)}\n"
        f"inferred_components (volume/material hints ONLY — not invent permission):\n"
        f"{_bullets(inferred)}\n"
        f"allowed_completion / reconstruction:\n{_bullets(allowed)}\n"
        f"forbidden_additions (HARD BANS):\n{_bullets(forbidden)}\n"
        "\n"
        f"{face_block}\n"
        "\n"
        f"{color_block}"
        "\n"
        "Creative anchors to preserve (VERY STRONG):\n"
        "- Subject / object identity from the doodle + semantic lock.\n"
        "- Expression, pose/posture, orientation/viewing angle.\n"
        "- Major proportions, distinctive features, relative placement of meaningful parts.\n"
        "- Intentional asymmetry and quirks (authorship) — not execution noise.\n"
        "Free to change: exact stroke paths, wobble, jagged contours, bad joins, "
        "accidental gaps, uneven thickness, malformed circles, drawing artifacts.\n"
        "When exact source geometry conflicts with polish: preserve the creative anchor "
        "and release the low-level geometry.\n"
        "Interior marks stay on parent surfaces; meaningful open strokes stay open "
        "(clean their execution).\n"
        "Delight from reconstruction + volume/material — never from inventing identity "
        "or unsupported faces.\n"
        "\n"
        f"Style separation: this output must read unmistakably as {style_id.upper()} — "
        "not the other three styles. Apply the style aggressively after reconstruction.\n"
    )
