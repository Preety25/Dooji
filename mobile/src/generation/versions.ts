/**
 * Version pins for generation-cache identity.
 * Mirror product style JSON versions; bump when transform/prompt doctrine changes.
 */
import type { StyleId } from '../models/types';
import { TRANSFORM_VERSION } from '../transform/contracts';

/** Current style pack versions (see product/styles/*.json). Must stay in sync. */
export const STYLE_VERSIONS: Record<StyleId, string> = {
  gummy: '1.0.0',
  clay: '1.0.0',
  plush: '1.1.0',
  glossy: '1.0.0',
};

/**
 * Semantic / prompt-compiler generation identity.
 * Bump when recognition defaults or execution doctrine change in a way that
 * should invalidate cached stickers (independent of style pack version).
 */
export const SEMANTIC_VERSION = 'product.mvp.semantic.v1';

export interface GenerationVersionBundle {
  transformVersion: string;
  styleVersion: string;
  semanticVersion: string;
}

export function currentVersionsForStyle(style: StyleId): GenerationVersionBundle {
  return {
    transformVersion: TRANSFORM_VERSION,
    styleVersion: STYLE_VERSIONS[style],
    semanticVersion: SEMANTIC_VERSION,
  };
}
