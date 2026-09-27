import type { DoodleStroke } from '../models/types';
import type { StrokeJson } from '../transform/contracts';

export function strokesToSvgPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

export function toStrokeJson(
  strokes: DoodleStroke[],
  canvas: { width: number; height: number },
): StrokeJson {
  return {
    canvas,
    strokes: strokes
      .filter((s) => s.tool === 'brush' && s.points.length >= 2)
      .map((s) => ({
        id: s.id,
        points: s.points.map((p) => [p.x, p.y] as [number, number]),
        closed: Boolean(s.closed),
        color: s.color,
        // width is product-extension (schema allows additional props); PNG is primary.
        width: s.width,
      })),
    meta: {
      exported_at: new Date().toISOString(),
      source: 'dooji-mobile',
    },
  };
}

export function cloneStrokes(strokes: DoodleStroke[]): DoodleStroke[] {
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p })),
  }));
}
