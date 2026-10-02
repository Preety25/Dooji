import type { TransformClient } from './client';
import type { TransformRequest, TransformResult } from './contracts';
import { resolveTransformBaseUrl } from './client';
import { getAnonymousClientId } from '../usage/anonymousId';
import { transformDebug } from '../lib/transformDebug';

/**
 * HTTP client for the product transform API.
 * POST {base}/v1/transform — same JSON contract as product/api/app.py.
 * Does not embed prompts, style sheets, or provider secrets.
 */
export class HttpTransformClient implements TransformClient {
  constructor(private readonly baseUrl: string = resolveTransformBaseUrl()) {}

  async transform(request: TransformRequest): Promise<TransformResult> {
    const url = `${this.baseUrl}/v1/transform`;
    const anon = request.anonymous_client_id || (await getAnonymousClientId());
    const body = { ...request, anonymous_client_id: anon };
    transformDebug('http-transform-start', {
      url,
      style: request.style,
      hasRaster: Boolean(request.doodle_base64),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Dooji-Client-Id': anon,
      },
      body: JSON.stringify(body),
    });
    transformDebug('http-transform-response', {
      status: res.status,
      ok: res.ok,
    });
    let parsed: TransformResult;
    try {
      parsed = (await res.json()) as TransformResult;
    } catch {
      return {
        status: 'error',
        style: request.style,
        transform_version: 'unknown',
        error: `bad_response_${res.status}`,
      };
    }
    if (res.status === 429 || parsed.status === 'rate_limited') {
      return { ...parsed, status: 'rate_limited' };
    }
    if (!res.ok && parsed.status !== 'error') {
      return {
        ...parsed,
        status: 'error',
        error: parsed.error || `http_${res.status}`,
      };
    }
    return parsed;
  }
}
