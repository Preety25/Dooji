import type { TransformClient } from './client';
import { resolveTransformMode } from './client';
import { HttpTransformClient } from './httpClient';
import { MockTransformClient } from './mockClient';
import { transformDebug } from '../lib/transformDebug';

let singleton: TransformClient | null = null;

/**
 * App entry to the transform boundary.
 * Development default: MOCK. Production builds require http + HTTPS URL (fail closed).
 */
export function getTransformClient(): TransformClient {
  if (!singleton) {
    const mode = resolveTransformMode();
    transformDebug('transform-client-init', { mode });
    singleton =
      mode === 'http' ? new HttpTransformClient() : new MockTransformClient();
  }
  return singleton;
}

export function resetTransformClientForTests(): void {
  singleton = null;
}

export type { TransformClient } from './client';
export type { TransformRequest, TransformResult } from './contracts';
