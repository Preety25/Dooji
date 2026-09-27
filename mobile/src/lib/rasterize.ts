/**
 * Client-side doodle raster helpers.
 * TransformRequest carries the PNG (primary identity) + canonical stroke JSON.
 * No prompts / provider secrets here.
 */

import type { DoodleStroke } from '../models/types';

/** Target square resolution for transform PNG. */
export const RASTER_SIZE = 1024;

/**
 * Map layout-space strokes into a square transparent canvas, preserving
 * colors, brush widths, and spatial relationships (letterboxed).
 */
export function mapStrokesToSquare(
  strokes: DoodleStroke[],
  canvasW: number,
  canvasH: number,
  size: number = RASTER_SIZE,
): DoodleStroke[] {
  const w = Math.max(1, canvasW);
  const h = Math.max(1, canvasH);
  const scale = Math.min(size / w, size / h);
  const ox = (size - w * scale) / 2;
  const oy = (size - h * scale) / 2;
  return strokes.map((s) => ({
    ...s,
    width: Math.max(1, s.width * scale),
    points: s.points.map((p) => ({
      x: p.x * scale + ox,
      y: p.y * scale + oy,
    })),
  }));
}

/** Strip data-URI prefix if present; return raw base64. */
export function stripDataUriBase64(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('data:') && s.includes(',')) {
    return s.split(',', 1)[1] ?? '';
  }
  return s;
}
