/** Typed analytics placeholder — local console log only, no platform SDK. */

export type AnalyticsEvent =
  | 'app_open'
  | 'canvas_started'
  | 'doodle_completed'
  | 'preview_viewed'
  | 'style_selected'
  | 'surprise_me_selected'
  | 'create_style_clicked'
  | 'style_cache_hit'
  | 'transform_started'
  | 'transform_succeeded'
  | 'transform_failed'
  | 'edit_doodle'
  | 'saved'
  | 'shared'
  | 'new_doodle';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

const buffer: { event: AnalyticsEvent; props?: AnalyticsProps; at: string }[] = [];

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const entry = { event, props, at: new Date().toISOString() };
  buffer.push(entry);
  // Local log OK — no Amplitude/Segment/etc.
  // eslint-disable-next-line no-console
  console.log('[analytics]', event, props ?? {});
}

export function getAnalyticsBuffer() {
  return [...buffer];
}

export function clearAnalyticsBuffer(): void {
  buffer.length = 0;
}
