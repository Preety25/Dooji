/**
 * Transform config + network error mapping (no React Native imports).
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  TransformConfigError,
  isProductionAppEnv,
  resolveTransformBaseUrl,
  resolveTransformMode,
  resolveTransformTimeoutMs,
} from './client';
import { mapTransformNetworkFailure } from './networkErrors';

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  delete process.env.EXPO_PUBLIC_TRANSFORM_MODE;
  delete process.env.EXPO_PUBLIC_TRANSFORM_API_URL;
  delete process.env.EXPO_PUBLIC_TRANSFORM_TIMEOUT_MS;
});

describe('transform production config', () => {
  it('development defaults to mock when mode unset', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    delete process.env.EXPO_PUBLIC_TRANSFORM_MODE;
    assert.equal(resolveTransformMode(), 'mock');
    assert.equal(isProductionAppEnv(), false);
  });

  it('development falls back to localhost URL', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    delete process.env.EXPO_PUBLIC_TRANSFORM_API_URL;
    assert.equal(resolveTransformBaseUrl(), 'http://127.0.0.1:8080');
  });

  it('production rejects unset/mock mode', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    delete process.env.EXPO_PUBLIC_TRANSFORM_MODE;
    assert.throws(() => resolveTransformMode(), TransformConfigError);
    process.env.EXPO_PUBLIC_TRANSFORM_MODE = 'mock';
    assert.throws(() => resolveTransformMode(), TransformConfigError);
  });

  it('production requires https API URL and rejects localhost', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_TRANSFORM_MODE = 'http';
    delete process.env.EXPO_PUBLIC_TRANSFORM_API_URL;
    assert.throws(() => resolveTransformBaseUrl(), TransformConfigError);

    process.env.EXPO_PUBLIC_TRANSFORM_API_URL = 'http://api.example.com';
    assert.throws(() => resolveTransformBaseUrl(), TransformConfigError);

    process.env.EXPO_PUBLIC_TRANSFORM_API_URL = 'https://127.0.0.1:8080';
    assert.throws(() => resolveTransformBaseUrl(), TransformConfigError);

    process.env.EXPO_PUBLIC_TRANSFORM_API_URL = 'https://api.example.com/';
    assert.equal(resolveTransformBaseUrl(), 'https://api.example.com');
  });

  it('timeout default is 90s and env override works', () => {
    delete process.env.EXPO_PUBLIC_TRANSFORM_TIMEOUT_MS;
    assert.equal(resolveTransformTimeoutMs(), 90_000);
    process.env.EXPO_PUBLIC_TRANSFORM_TIMEOUT_MS = '1500';
    assert.equal(resolveTransformTimeoutMs(), 1500);
  });
});

describe('transform network failure mapping', () => {
  it('maps AbortError / aborted to timeout technical error', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const result = mapTransformNetworkFailure('gummy', err, true);
    assert.equal(result.status, 'error');
    assert.equal(result.error, 'timeout');
    assert.notEqual(result.status, 'rate_limited');
  });

  it('maps other network errors to network_error', () => {
    const result = mapTransformNetworkFailure('clay', new Error('ECONNREFUSED'), false);
    assert.equal(result.status, 'error');
    assert.equal(result.error, 'network_error');
  });
});
