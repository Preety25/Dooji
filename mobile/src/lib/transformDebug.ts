/**
 * Dev-only transform pipeline diagnostics.
 * Silent in production builds (`__DEV__ === false`).
 */
export function transformDebug(
  message: string,
  props?: Record<string, unknown>,
): void {
  const isDev =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : process.env.NODE_ENV !== 'production';
  if (!isDev) return;
  if (props !== undefined) {
    console.log('[TRANSFORM DEBUG]', message, props);
  } else {
    console.log('[TRANSFORM DEBUG]', message);
  }
}
