/**
 * Per-Creation, per-style generation cache helpers (provider-agnostic).
 *
 * Cache identity: creationId + style + doodleFingerprint + transform/style/semantic versions.
 * At most one current GeneratedAsset is kept per style on a Creation.
 */
import type {
  Creation,
  DoodleStroke,
  GeneratedAsset,
  StyleId,
} from '../models/types';
import {
  currentVersionsForStyle,
  type GenerationVersionBundle,
} from './versions';

/** Stable fingerprint of the canonical doodle (strokes + canvas). */
export function doodleFingerprint(
  strokes: DoodleStroke[],
  canvas: { width: number; height: number },
): string {
  const payload = JSON.stringify({
    w: Math.round(canvas.width),
    h: Math.round(canvas.height),
    strokes: strokes.map((s) => ({
      id: s.id,
      tool: s.tool,
      color: s.color,
      width: s.width,
      closed: Boolean(s.closed),
      points: s.points.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]),
    })),
  });
  return `doodle:${fnv1aHex(payload)}`;
}

export function isAssetCompatible(
  asset: GeneratedAsset,
  opts: {
    creationId: string;
    style: StyleId;
    fingerprint: string;
    versions: GenerationVersionBundle;
  },
): boolean {
  if (asset.creationId !== opts.creationId) return false;
  if (asset.style !== opts.style) return false;
  if (!asset.imageUri) return false;
  if (asset.doodleFingerprint !== opts.fingerprint) return false;
  if (asset.transformVersion !== opts.versions.transformVersion) return false;
  if (asset.styleVersion !== opts.versions.styleVersion) return false;
  if (asset.semanticVersion !== opts.versions.semanticVersion) return false;
  return true;
}

/** Return the single valid cached asset for style, if any. */
export function lookupCachedAsset(
  creation: Creation,
  style: StyleId,
  versions: GenerationVersionBundle = currentVersionsForStyle(style),
): GeneratedAsset | undefined {
  const fingerprint = doodleFingerprint(creation.strokes, creation.canvas);
  const matches = creation.assets.filter((a) =>
    isAssetCompatible(a, {
      creationId: creation.id,
      style,
      fingerprint,
      versions,
    }),
  );
  if (!matches.length) return undefined;
  return [...matches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

/** Keep at most one *current* asset slot per style id (replace prior for that style).
 * Historical assets for other doodle fingerprints remain until replaced by style upsert;
 * validity is enforced by {@link lookupCachedAsset} fingerprint/version checks.
 */
export function upsertStyleAsset(
  creation: Creation,
  asset: GeneratedAsset,
): Creation {
  // Replace only same-style assets that share this doodle fingerprint (or lack one).
  const nextAssets = creation.assets.filter((a) => {
    if (a.style !== asset.style) return true;
    if (!a.doodleFingerprint || !asset.doodleFingerprint) return false;
    return a.doodleFingerprint !== asset.doodleFingerprint;
  });
  nextAssets.push(asset);
  return {
    ...creation,
    /** Last successfully generated style — preference for library open, not UI selection. */
    style: asset.style,
    assets: nextAssets,
    updatedAt: asset.createdAt || creation.updatedAt,
  };
}

/** Drop all generated assets (e.g. doodle edited). Strokes remain canonical. */
export function clearGeneratedAssets(creation: Creation): Creation {
  if (!creation.assets.length) return creation;
  return {
    ...creation,
    assets: [],
    updatedAt: creation.updatedAt,
  };
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
