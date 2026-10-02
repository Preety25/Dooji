import type { TransformResult } from './contracts';

/** Map fetch/network failures into the existing transform error contract. */
export function mapTransformNetworkFailure(
  style: string,
  err: unknown,
  aborted: boolean,
): TransformResult {
  const name = err instanceof Error ? err.name : 'unknown';
  const isAbort = aborted || name === 'AbortError';
  return {
    status: 'error',
    style,
    transform_version: 'unknown',
    error: isAbort ? 'timeout' : 'network_error',
  };
}
