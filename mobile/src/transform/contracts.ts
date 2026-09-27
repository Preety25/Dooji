/**
 * Mobile-facing transform contracts — mirror of product/transform/contracts.py.
 * UI knows only TransformRequest / TransformResult. No prompts, keys, or providers.
 */

import type { StyleId } from '../models/types';

export interface TransformOptions {
  size?: number;
  dry_run?: boolean;
}

export interface StrokeJsonPoint {
  /** Schema uses [x, y] tuples. */
  0?: number;
  1?: number;
}

export interface StrokeJsonStroke {
  id: string;
  points: [number, number][];
  closed?: boolean;
  color?: string | null;
  /** Brush width in canvas units (product extension; PNG remains primary). */
  width?: number;
}

export interface StrokeJson {
  canvas: { width: number; height: number };
  strokes: StrokeJsonStroke[];
  meta?: Record<string, unknown>;
}

export interface TransformRequest {
  style: StyleId;
  /**
   * Normalized doodle PNG as base64 (no data: prefix).
   * Required for live transform — primary identity signal alongside strokes.
   */
  doodle_base64?: string;
  /** Canonical stroke JSON (source of truth for edit/retry; complements PNG). */
  strokes?: StrokeJson;
  client_doodle_id?: string;
  options?: TransformOptions;
}

export type TransformStatus = 'ok' | 'error' | 'dry_run';

export interface TransformResult {
  status: TransformStatus;
  style: StyleId | string;
  transform_version: string;
  provider?: string | null;
  model?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  image_base64?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export const TRANSFORM_VERSION = 'product.mvp.v1';
