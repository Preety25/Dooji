/**
 * Ensure a Creation has a generated asset for a style — cache-first, provider-agnostic.
 */
import { newId, nowIso } from '../lib/id';
import { cloneStrokes, toStrokeJson } from '../lib/strokes';
import type {
  Creation,
  GeneratedAsset,
  GenerationJob,
  StyleId,
} from '../models/types';
import type { TransformClient } from '../transform/client';
import type { TransformResult } from '../transform/contracts';
import {
  doodleFingerprint,
  lookupCachedAsset,
  upsertStyleAsset,
} from './cache';
import { currentVersionsForStyle } from './versions';
import { transformDebug } from '../lib/transformDebug';

export type EnsureStyleReason = 'make' | 'style' | 'retry';

export type EnsureStyleResult =
  | {
      kind: 'cache_hit';
      style: StyleId;
      asset: GeneratedAsset;
      creation: Creation;
      transformCalled: false;
    }
  | {
      kind: 'generated';
      style: StyleId;
      asset: GeneratedAsset;
      creation: Creation;
      job: GenerationJob;
      transformCalled: true;
      result: TransformResult;
    }
  | {
      kind: 'error';
      style: StyleId;
      creation: Creation;
      job: GenerationJob;
      transformCalled: boolean;
      error: string;
    };

export interface EnsureStyleAssetDeps {
  creation: Creation;
  style: StyleId;
  /** Live canvas layout (stroke coordinate space). */
  canvas: { width: number; height: number };
  client: TransformClient;
  /** Capture current doodle PNG as raw base64 (no data: prefix). */
  rasterize: () => Promise<string>;
  /** When false, miss returns without calling transform (style pick without generate). */
  generateIfMissing?: boolean;
  reason?: EnsureStyleReason;
}

/**
 * Cache hit → return immediately (no transform).
 * Cache miss + generateIfMissing → call TransformClient once and store asset.
 */
export async function ensureStyleAsset(
  deps: EnsureStyleAssetDeps,
): Promise<EnsureStyleResult> {
  const {
    creation,
    style,
    canvas,
    client,
    rasterize,
    generateIfMissing = true,
  } = deps;
  const versions = currentVersionsForStyle(style);
  const cached = lookupCachedAsset(creation, style, versions);
  if (cached) {
    return {
      kind: 'cache_hit',
      style,
      asset: cached,
      creation,
      transformCalled: false,
    };
  }

  if (!generateIfMissing) {
    const job: GenerationJob = {
      id: newId('job'),
      creationId: creation.id,
      style,
      status: 'cancelled',
      startedAt: nowIso(),
      finishedAt: nowIso(),
      error: 'cache_miss_no_generate',
    };
    return {
      kind: 'error',
      style,
      creation,
      job,
      transformCalled: false,
      error: 'cache_miss_no_generate',
    };
  }

  const job: GenerationJob = {
    id: newId('job'),
    creationId: creation.id,
    style,
    status: 'running',
    startedAt: nowIso(),
  };

  const strokesSnapshot = cloneStrokes(creation.strokes);
  const canvasSize = {
    width: canvas.width || creation.canvas.width,
    height: canvas.height || creation.canvas.height,
  };
  const fingerprint = doodleFingerprint(strokesSnapshot, canvasSize);

  let doodleBase64: string;
  try {
    transformDebug('rasterize-start');
    doodleBase64 = await rasterize();
    if (!doodleBase64) throw new Error('raster_capture_empty');
    transformDebug('rasterize-ok', {
      bytes: doodleBase64.length,
    });
  } catch (err) {
    transformDebug('rasterize-failed', {
      error: err instanceof Error ? err.message : 'raster_failed',
    });
    const done: GenerationJob = {
      ...job,
      status: 'failed',
      finishedAt: nowIso(),
      error: err instanceof Error ? err.message : 'raster_failed',
    };
    return {
      kind: 'error',
      style,
      creation: {
        ...creation,
        style,
        strokes: strokesSnapshot,
        jobs: [...creation.jobs, done],
        updatedAt: nowIso(),
      },
      job: done,
      transformCalled: false,
      error: done.error || 'raster_failed',
    };
  }

  transformDebug('provider-call-start', { style });
  const result = await client.transform({
    style,
    doodle_base64: doodleBase64,
    strokes: toStrokeJson(strokesSnapshot, canvasSize),
    client_doodle_id: creation.id,
    options: { size: 1024 },
  });
  transformDebug('provider-call-done', {
    status: result.status,
    hasUrl: Boolean(result.image_url),
    hasB64: Boolean(result.image_base64),
    provider: result.provider,
    error: result.error,
  });

  if (result.status === 'rate_limited') {
    const done: GenerationJob = {
      ...job,
      status: 'failed',
      finishedAt: nowIso(),
      error: 'rate_limited',
    };
    return {
      kind: 'error',
      style,
      creation: {
        ...creation,
        style,
        strokes: strokesSnapshot,
        jobs: [...creation.jobs.filter((j) => j.id !== job.id), done],
        updatedAt: nowIso(),
      },
      job: done,
      transformCalled: false,
      error: 'rate_limited',
    };
  }

  if (result.status === 'ok' && (result.image_url || result.image_base64)) {
    const imageUri = result.image_url
      ? result.image_url
      : `data:image/png;base64,${result.image_base64}`;
    const meta = result.metadata || {};
    const styleVersionFromServer =
      typeof meta.style_version === 'string' ? meta.style_version : versions.styleVersion;
    const asset: GeneratedAsset = {
      id: newId('asset'),
      creationId: creation.id,
      style,
      imageUri,
      transformVersion: result.transform_version || versions.transformVersion,
      styleVersion: styleVersionFromServer,
      semanticVersion: versions.semanticVersion,
      doodleFingerprint: fingerprint,
      provider: result.provider ?? undefined,
      createdAt: nowIso(),
      metadata: result.metadata,
    };
    const done: GenerationJob = {
      ...job,
      status: 'succeeded',
      finishedAt: nowIso(),
      assetId: asset.id,
    };
    const withAsset = upsertStyleAsset(
      {
        ...creation,
        strokes: strokesSnapshot,
        canvas: canvasSize,
        doodlePreviewUri: `data:image/png;base64,${doodleBase64}`,
        jobs: [...creation.jobs.filter((j) => j.id !== job.id), done],
        updatedAt: nowIso(),
      },
      asset,
    );
    return {
      kind: 'generated',
      style,
      asset,
      creation: withAsset,
      job: done,
      transformCalled: true,
      result,
    };
  }

  const done: GenerationJob = {
    ...job,
    status: 'failed',
    finishedAt: nowIso(),
    error: result.error || 'unknown',
  };
  return {
    kind: 'error',
    style,
    creation: {
      ...creation,
      style,
      strokes: strokesSnapshot,
      canvas: canvasSize,
      doodlePreviewUri: `data:image/png;base64,${doodleBase64}`,
      jobs: [...creation.jobs.filter((j) => j.id !== job.id), done],
      updatedAt: nowIso(),
    },
    job: done,
    transformCalled: true,
    error: done.error || 'unknown',
  };
}
