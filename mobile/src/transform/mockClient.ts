import { Asset } from 'expo-asset';

import type { StyleId } from '../models/types';
import type { TransformClient } from './client';
import {
  TRANSFORM_VERSION,
  type TransformRequest,
  type TransformResult,
} from './contracts';
import { mockAssetModule } from './mockAssets';
import { transformDebug } from '../lib/transformDebug';

/**
 * Local mock transform — never calls network image APIs.
 * Resolves style sample PNGs that stand in for V4-generated stickers.
 */
export class MockTransformClient implements TransformClient {
  private variation = 0;

  async transform(request: TransformRequest): Promise<TransformResult> {
    const style = (request.style || 'gummy') as StyleId;
    transformDebug('mock-transform-start', {
      style,
      hasRaster: Boolean(request.doodle_base64),
      strokeCount: request.strokes?.strokes?.length ?? 0,
    });
    // Light playful latency — not a fake long progress bar.
    await delay(450 + Math.random() * 350);

    if (request.options?.dry_run) {
      return {
        status: 'dry_run',
        style,
        transform_version: TRANSFORM_VERSION,
        provider: 'mock',
        model: 'mock-v4-samples',
        metadata: { dry_run: true },
      };
    }

    try {
      const mod = mockAssetModule(style, this.variation);
      this.variation += 1;
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      if (!uri) {
        throw new Error('mock asset missing');
      }
      transformDebug('mock-result-returned', {
        status: 'ok',
        style,
        image_url: uri.slice(0, 80),
      });
      return {
        status: 'ok',
        style,
        transform_version: TRANSFORM_VERSION,
        provider: 'mock',
        model: 'mock-v4-samples',
        image_url: uri,
        metadata: {
          mock: true,
          sample: true,
          client_doodle_id: request.client_doodle_id ?? null,
          has_doodle_raster: Boolean(request.doodle_base64),
          has_strokes: Boolean(request.strokes?.strokes?.length),
        },
      };
    } catch (err) {
      transformDebug('mock-result-error', {
        error: err instanceof Error ? err.message : 'mock_failed',
      });
      return {
        status: 'error',
        style,
        transform_version: TRANSFORM_VERSION,
        provider: 'mock',
        error: err instanceof Error ? err.message : 'mock_failed',
      };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
