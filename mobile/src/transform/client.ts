/**
 * Transform client configuration.
 *
 * Development (__DEV__ / non-production): mock + localhost remain easy.
 * Production builds fail closed — no silent mock or localhost fallback.
 */
import type { TransformRequest, TransformResult } from './contracts';

export interface TransformClient {
  transform(request: TransformRequest): Promise<TransformResult>;
}

export type TransformMode = 'mock' | 'http';

export class TransformConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransformConfigError';
  }
}

function appEnv(): string {
  return (process.env.EXPO_PUBLIC_APP_ENV || '').trim().toLowerCase();
}

/** Production = release build, or explicit EXPO_PUBLIC_APP_ENV=production. */
export function isProductionAppEnv(): boolean {
  const env = appEnv();
  if (env === 'production' || env === 'prod') return true;
  if (env === 'development' || env === 'dev') return false;
  return typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production';
}

export function resolveTransformMode(): TransformMode {
  const raw = (process.env.EXPO_PUBLIC_TRANSFORM_MODE || '').trim().toLowerCase();
  if (isProductionAppEnv()) {
    if (raw !== 'http') {
      throw new TransformConfigError(
        'Production requires EXPO_PUBLIC_TRANSFORM_MODE=http (mock is not allowed).',
      );
    }
    return 'http';
  }
  // Development default: mock when unset.
  if (!raw) return 'mock';
  return raw === 'http' ? 'http' : 'mock';
}

export function resolveTransformBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_TRANSFORM_API_URL || '').trim().replace(/\/$/, '');
  if (isProductionAppEnv()) {
    if (!raw) {
      throw new TransformConfigError(
        'Production requires EXPO_PUBLIC_TRANSFORM_API_URL (HTTPS API origin).',
      );
    }
    if (!/^https:\/\//i.test(raw)) {
      throw new TransformConfigError(
        'Production EXPO_PUBLIC_TRANSFORM_API_URL must use https://',
      );
    }
    if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/i.test(raw)) {
      throw new TransformConfigError(
        'Production EXPO_PUBLIC_TRANSFORM_API_URL cannot target localhost.',
      );
    }
    return raw;
  }
  return raw || 'http://127.0.0.1:8080';
}

/** Client-side AbortController timeout (ms). Default 90s. */
export function resolveTransformTimeoutMs(): number {
  const raw = (process.env.EXPO_PUBLIC_TRANSFORM_TIMEOUT_MS || '').trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 90_000;
}
