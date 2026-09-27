"""Style pack loader — styles as versioned data, not scattered code.

Single product-level style system:
  product/styles/{id}.json          → versioned config
  product/assets/style_sheets/      → canonical material-only sheets
  docs/refs/style_sheets/           → mirror for lab path compatibility
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
STYLES_DIR = ROOT / "product" / "styles"
ASSETS_SHEETS = ROOT / "product" / "assets" / "style_sheets"
DOCS_SHEETS = ROOT / "docs" / "refs" / "style_sheets"
DOCS_REFS = ROOT / "docs" / "refs"


@dataclass(frozen=True)
class StyleConfig:
    id: str
    version: str
    display_name: str
    description: str
    sheet: str
    sheet_fallbacks: tuple[str, ...]
    visual_language: str
    form_language: str
    material_language: str
    lighting_language: str
    forbidden: tuple[str, ...]
    prompt_fragments: dict[str, str]
    raw: dict[str, Any]

    @property
    def look_line(self) -> str:
        """Combined material/form/lighting line for prompt compilation."""
        parts = [
            self.prompt_fragments.get("look")
            or f"{self.id.upper()} material: {self.material_language}",
        ]
        if self.visual_language:
            parts.append(f"Visual language: {self.visual_language}")
        if self.form_language:
            parts.append(f"Form: {self.form_language}")
        if self.lighting_language:
            parts.append(f"Lighting: {self.lighting_language}")
        return " ".join(parts)

    def resolve_sheet(self, *, root: Path | None = None) -> Path | None:
        """Return first existing sheet path (canonical then fallbacks)."""
        base = root or ROOT
        candidates = [self.sheet, *self.sheet_fallbacks]
        for rel in candidates:
            if not rel:
                continue
            p = Path(rel)
            if not p.is_absolute():
                p = base / rel
            if p.is_file():
                return p
        return None


_CACHE: dict[str, StyleConfig] = {}


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_style(style_id: str, *, root: Path | None = None) -> StyleConfig:
    sid = style_id.lower().strip()
    if sid in _CACHE and root is None:
        return _CACHE[sid]
    base = root or ROOT
    path = base / "product" / "styles" / f"{sid}.json"
    if not path.is_file():
        raise FileNotFoundError(f"style config missing: {path}")
    raw = _load_json(path)
    cfg = StyleConfig(
        id=raw["id"],
        version=str(raw.get("version") or "0.0.0"),
        display_name=raw.get("display_name") or raw["id"],
        description=raw.get("description") or "",
        sheet=raw.get("sheet") or "",
        sheet_fallbacks=tuple(raw.get("sheet_fallbacks") or ()),
        visual_language=raw.get("visual_language") or "",
        form_language=raw.get("form_language") or "",
        material_language=raw.get("material_language") or "",
        lighting_language=raw.get("lighting_language") or "",
        forbidden=tuple(raw.get("forbidden") or ()),
        prompt_fragments=dict(raw.get("prompt_fragments") or {}),
        raw=raw,
    )
    if root is None:
        _CACHE[sid] = cfg
    return cfg


def list_styles(*, root: Path | None = None) -> list[str]:
    base = (root or ROOT) / "product" / "styles"
    return sorted(p.stem for p in base.glob("*.json"))


def clear_style_cache() -> None:
    _CACHE.clear()
