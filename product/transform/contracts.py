"""Transform request/result contracts — provider-agnostic, mobile-facing shape."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


STYLES = ("gummy", "clay", "plush", "glossy")


@dataclass
class TransformOptions:
    """Client-safe options. Prompt / provider knobs stay server-side."""

    size: int = 1024
    dry_run: bool = False
    # Optional recognition override (tests / future VLM). Never required from mobile.
    recognition: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class TransformRequest:
    """Inbound transform contract for POST /v1/transform.

    Live path expects both a raster doodle PNG (primary identity) and canonical
    stroke JSON. Strokes alone remain accepted for server-side raster fallback.

    No provider names, prompts, style sheets, or API keys.
    """

    style: str
    doodle_png: bytes | None = None
    doodle_path: str | None = None
    strokes: dict[str, Any] | None = None
    client_doodle_id: str | None = None
    options: TransformOptions = field(default_factory=TransformOptions)

    def __post_init__(self) -> None:
        style = (self.style or "").lower().strip()
        if style not in STYLES:
            raise ValueError(f"style must be one of {STYLES}; got {self.style!r}")
        self.style = style
        if isinstance(self.options, dict):
            self.options = TransformOptions(**{
                k: v for k, v in self.options.items() if k in TransformOptions.__dataclass_fields__
            })
        if not self.doodle_png and not self.doodle_path and not self.strokes:
            raise ValueError("provide doodle_png, doodle_path, or strokes")

    @property
    def has_raster(self) -> bool:
        return bool(self.doodle_png) or bool(self.doodle_path)

    @property
    def has_strokes(self) -> bool:
        return bool(self.strokes)


@dataclass
class TransformResult:
    """Outbound transform contract. Prompts never returned to clients."""

    status: str  # "ok" | "error" | "dry_run"
    style: str
    transform_version: str
    provider: str | None = None
    model: str | None = None
    image_path: str | None = None
    image_url: str | None = None
    image_base64: str | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self, *, include_image_base64: bool = True) -> dict[str, Any]:
        d = asdict(self)
        if not include_image_base64:
            d.pop("image_base64", None)
        return d
