"""V4.4 stroke-role taxonomy for semantic parsing.

Every meaningful stroke/group gets exactly one role. Roles drive transform
rules BEFORE style is applied. Style sheets never override role decisions.
"""
from __future__ import annotations

from typing import Any

# Canonical role codes (A–G)
ROLE_BOUNDARY = "A_boundary_silhouette"
ROLE_INTERIOR_MARK = "B_interior_surface_mark"
ROLE_ATTACHMENT = "C_attachment_connector"
ROLE_OPEN_STROKE = "D_meaningful_open_stroke"
ROLE_BROKEN_CONTOUR = "E_broken_structural_contour"
ROLE_INDEPENDENT = "F_independent_component"
ROLE_AMBIGUOUS = "G_ambiguous"

ROLE_CODES = (
    ROLE_BOUNDARY,
    ROLE_INTERIOR_MARK,
    ROLE_ATTACHMENT,
    ROLE_OPEN_STROKE,
    ROLE_BROKEN_CONTOUR,
    ROLE_INDEPENDENT,
    ROLE_AMBIGUOUS,
)

ROLE_SHORT = {
    ROLE_BOUNDARY: "A",
    ROLE_INTERIOR_MARK: "B",
    ROLE_ATTACHMENT: "C",
    ROLE_OPEN_STROKE: "D",
    ROLE_BROKEN_CONTOUR: "E",
    ROLE_INDEPENDENT: "F",
    ROLE_AMBIGUOUS: "G",
}

# Material inheritance for interior surface marks (role B) by style
INTERIOR_MARK_MATERIAL = {
    "gummy": "embedded / translucent inlay inside parent gelatin volume",
    "clay": "painted or embossed mark on parent clay surface",
    "plush": "stitched / applique / embroidered mark on parent fabric",
    "glossy": "molded-in or inset surface detail on solid resin/vinyl",
}

# Open-stroke kinds that must NEVER be auto-closed
OPEN_STROKE_KINDS = (
    "steam",
    "string",
    "whisker",
    "tail",
    "hair",
    "smile",
    "antenna",
    "spiral",
    "gesture",
)

# Priority hierarchy (binding): lower index = higher priority
PRIORITY_HIERARCHY = (
    "1_original_doodle",
    "2_stroke_role_analysis",
    "3_semantic_recognition",
    "4_transform_rules",
    "5_style_reference",
    "6_generative_creativity",
)


def role_label(role: str) -> str:
    short = ROLE_SHORT.get(role, "?")
    return f"{short} ({role})"


def interior_mark_instruction(style: str) -> str:
    mat = INTERIOR_MARK_MATERIAL.get(style, "surface detail on parent material")
    return (
        "INTERIOR SURFACE MARK rule: stroke substantially inside a recognized region "
        f"→ ROLE B surface mark. Inherits parent material: {mat}. "
        "NEVER float as a standalone ribbon/tube/independent object "
        "(especially zigzags inside a mug body)."
    )


def broken_contour_instruction() -> str:
    return (
        "BROKEN STRUCTURAL CONTOUR rule: repair and reconstruct broken joins. "
        "When endpoints are close, directions align, same contour, and closure is "
        "coherent — close and smooth the gap into clean geometry. "
        "Do not leave finger-draw gaps or jagged joins as intentional openings, "
        "and do not merely inflate the broken stroke as-is."
    )


def open_stroke_instruction() -> str:
    kinds = ", ".join(OPEN_STROKE_KINDS)
    return (
        f"MEANINGFUL OPEN STROKE rule: do NOT auto-close ({kinds}). "
        "Keep them as open gesture strokes with soft volume only along the drawn path."
    )


def validate_stroke_roles(stroke_roles: list[dict[str, Any]]) -> list[str]:
    """Return list of validation warnings (empty if clean)."""
    warnings: list[str] = []
    if not stroke_roles:
        warnings.append("stroke_roles empty")
        return warnings
    for i, sr in enumerate(stroke_roles):
        role = sr.get("role")
        if role not in ROLE_CODES:
            warnings.append(f"stroke[{i}] unknown role={role!r}")
        if not sr.get("id"):
            warnings.append(f"stroke[{i}] missing id")
        if role == ROLE_INTERIOR_MARK and not sr.get("parent_region"):
            warnings.append(f"stroke[{i}] interior mark missing parent_region")
        if role == ROLE_OPEN_STROKE and sr.get("auto_close"):
            warnings.append(f"stroke[{i}] open stroke must not auto_close")
    return warnings


def stroke_roles_prompt_block(stroke_roles: list[dict[str, Any]], style: str) -> str:
    """Format stroke-role table for the edit prompt."""
    lines = ["Stroke roles (binding — analyzed once; feed all styles):"]
    for sr in stroke_roles:
        rid = sr.get("id", "?")
        role = sr.get("role", ROLE_AMBIGUOUS)
        desc = sr.get("description", "")
        parent = sr.get("parent_region")
        short = ROLE_SHORT.get(role, "?")
        extra = ""
        if parent:
            extra += f" parent={parent}"
        if sr.get("kind"):
            extra += f" kind={sr['kind']}"
        if role == ROLE_INTERIOR_MARK:
            extra += f" → {INTERIOR_MARK_MATERIAL.get(style, 'surface mark')}"
        if role == ROLE_OPEN_STROKE:
            extra += " DO_NOT_AUTO_CLOSE"
        if role == ROLE_BROKEN_CONTOUR and sr.get("close_and_smooth"):
            extra += " CLOSE_AND_SMOOTH"
        lines.append(f"- [{short}] {rid}: {desc}{extra}")
    lines.append(interior_mark_instruction(style))
    lines.append(broken_contour_instruction())
    lines.append(open_stroke_instruction())
    return "\n".join(lines)
