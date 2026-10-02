/** Morph math — RN port of Magic Patterns morph helpers (no DOM). */
import type { StrokePoint } from '../models/types';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function resampleEven(
  points: StrokePoint[],
  n: number,
  closed: boolean,
): StrokePoint[] {
  if (points.length < 2) {
    const p = points[0] ?? { x: 0, y: 0 };
    return Array.from({ length: n }, () => ({ ...p }));
  }
  const pts = closed ? [...points, points[0]!] : points;
  const cumulative = [0];
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1]! + distance(pts[i - 1]!, pts[i]!));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  const out: StrokePoint[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = closed ? (k / n) * total : (k / (n - 1)) * total;
    while (j < cumulative.length - 2 && cumulative[j + 1]! < target) j += 1;
    const seg = cumulative[j + 1]! - cumulative[j]! || 1;
    const t = clamp01((target - cumulative[j]!) / seg);
    out.push({
      x: lerp(pts[j]!.x, pts[j + 1]!.x, t),
      y: lerp(pts[j]!.y, pts[j + 1]!.y, t),
    });
  }
  return out;
}

export function lerpPoints(
  from: StrokePoint[],
  to: StrokePoint[],
  t: number,
): StrokePoint[] {
  return from.map((p, i) => ({
    x: lerp(p.x, to[i]?.x ?? p.x, t),
    y: lerp(p.y, to[i]?.y ?? p.y, t),
  }));
}

/** Light Chaikin smooth — refined destination geometry. */
export function chaikin(
  points: StrokePoint[],
  closed: boolean,
  iterations = 2,
): StrokePoint[] {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    if (pts.length < 3) return pts;
    const out: StrokePoint[] = [];
    const n = pts.length;
    if (!closed) out.push(pts[0]!);
    const segments = closed ? n : n - 1;
    for (let i = 0; i < segments; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % n]!;
      out.push(
        { x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y },
        { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y },
      );
    }
    if (!closed) out.push(pts[n - 1]!);
    pts = out;
  }
  return pts;
}

export function toSvgPath(points: StrokePoint[], closed: boolean): string {
  if (!points.length) return '';
  const f = (n: number) => n.toFixed(1);
  if (points.length === 1) {
    const p = points[0]!;
    return `M${f(p.x)} ${f(p.y)}L${f(p.x)} ${f(p.y)}`;
  }
  const [first, ...rest] = points;
  return `M${f(first!.x)} ${f(first!.y)}${rest
    .map((p) => `L${f(p.x)} ${f(p.y)}`)
    .join('')}${closed ? 'Z' : ''}`;
}

export function fitStrokesToBox<
  T extends { points: StrokePoint[]; width: number },
>(
  strokes: T[],
  box = 400,
  pad = 48,
): (T & { points: StrokePoint[]; width: number })[] {
  const all = strokes.flatMap((s) => s.points);
  if (!all.length) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  all.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const avail = box - pad * 2;
  const scale = Math.min(avail / w, avail / h, 3);
  const ox = (box - w * scale) / 2 - minX * scale;
  const oy = (box - h * scale) / 2 - minY * scale;
  return strokes.map((s) => ({
    ...s,
    width: s.width * scale,
    points: s.points.map((p) => ({
      x: p.x * scale + ox,
      y: p.y * scale + oy,
    })),
  }));
}

/** Phase timeline (~2.5s total). */
export const MORPH_PHASES = {
  trace: 0.6,
  morph: 0.6,
  inflate: 0.55,
  material: 0.55,
  settled: 2.5,
} as const;
