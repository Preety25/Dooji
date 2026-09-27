"""Production prompt compiler — V4.4 doctrine without lab SPECIAL/hardcoded doodle handlers.

Doctrine: Improve the execution, preserve the idea.
Doodle image = primary identity. Style sheets = material language only.
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

# Product-facing elastic fidelity (extends V4.4; never returned to mobile).
EXECUTION_DOCTRINE = (
    'Improve the execution, preserve the idea.\n'
    "ALLOWED: smooth and regularize contours; improve symmetry, proportion, alignment, "
    "spacing, and curvature; close tiny broken structural gaps; enrich dimensionality "
    "and material polish; make it plump / toy-like within observed topology.\n"
    "FORBIDDEN: replace the object with a generic category item; invent unsupported "
    "components, limbs, accessories, or decorations; auto-add faces unless clearly drawn; "
    "copy style-sheet subjects, poses, faces, or palette assignment."
)


def default_recognition(*, client_doodle_id: str | None = None) -> dict[str, Any]:
    """Minimal recognition when no VLM / lock is available yet.

    MVP does not block on full auto recognition. The doodle PNG is the primary
    identity signal; this lock is a conservative semantic scaffold. Existing
    stroke-role / recognition infra is used when a richer lock is supplied via
    options.recognition (tests / future VLM) — never a hand-curated mobile recognizer.
    """
    return {
        "id": client_doodle_id or "anonymous",
        "subject_hypothesis": "user doodle (preserve observed silhouette and parts)",
        "confidence": 0.0,
        "observed_components": [
            "all strokes and closed regions visible in the doodle PNG",
        ],
        "inferred_components": [
            "soft volume / material thickness consistent with chosen style (hint only)",
        ],
        "allowed_completion": [
            "smooth contour wobble",
            "close tiny broken structural gaps when endpoints align",
            "round forms within observed topology",
            "improve symmetry / proportion / curvature without changing identity",
        ],
        "forbidden_additions": [
            "invented face features unless drawn",
            "extra limbs / accessories not in the doodle",
            "second subject or scene elements",
            "copying style-sheet objects or palette",
            "replacing the doodle with a generic category object",
        ],
        "faces_observed": False,
        "face_policy": (
            "Invent eyes/mouth/cheeks/blush ONLY if the doodle clearly has them. "
            "Default: no face."
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
            f"PRIMARY = <IMAGE_0> (user doodle — visual + semantic source of truth).\n"
            f"<IMAGE_1> is the {style_id.upper()} STYLE SHEET (material language only).\n"
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
        f"POLISH THE USER'S DOODLE into a single centered isolated {style_id} toy/sticker object.\n"
        "The doodle image is the PRIMARY identity — improve execution; do not replace the idea.\n"
        "Clean presentation on transparent or pure empty void. No scene, floor, ground, text, "
        "drop shadow, or environment.\n"
        f"{style_header}\n"
        f"Style pack: {style_id} v{style_ver}\n"
        f"Material / look: {look}\n"
        f"{V44_STYLIZED_DIM}\n"
        f"{extra}\n"
        f"{V44_PRIORITY}\n"
        f"{V44_ELASTIC}\n"
        f"{identity_block}"
        f"{glossy_block}"
        f"{stroke_block}"
        "\n"
        "Semantic lock (recognized ONCE — same identity for all styles):\n"
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
        "\n"
        "Hard preserve:\n"
        "- Absolute object identity from the doodle + semantic lock.\n"
        "- Silhouette, proportions, component count, asymmetry, quirks.\n"
        "- Interior marks stay on parent surfaces; open strokes stay open.\n"
        "- Delight from volume/material ONLY — never from inventing identity or faces.\n"
        "\n"
        f"Style separation: this output must read unmistakably as {style_id.upper()} — "
        "not the other three styles.\n"
    )
