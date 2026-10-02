/**
 * Guards against duplicate in-flight transforms and stale async apply.
 */
import type { StyleId } from '../models/types';
import { generationRequestKey } from './flow';

export interface GenerationRequest {
  seq: number;
  key: string;
  creationId: string;
  fingerprint: string;
  style: StyleId;
}

export class GenerationGuard {
  private seq = 0;
  private inFlight: GenerationRequest | null = null;

  /** Begin a generation if one is not already running for the same key. */
  begin(opts: {
    creationId: string;
    fingerprint: string;
    style: StyleId;
  }): GenerationRequest | null {
    const key = generationRequestKey(opts);
    if (this.inFlight && this.inFlight.key === key) {
      return null; // duplicate Create for same Creation+source+style
    }
    const req: GenerationRequest = {
      seq: ++this.seq,
      key,
      creationId: opts.creationId,
      fingerprint: opts.fingerprint,
      style: opts.style,
    };
    this.inFlight = req;
    return req;
  }

  /** True if this response may still apply its UI transition. */
  isCurrent(req: GenerationRequest): boolean {
    return this.inFlight?.seq === req.seq;
  }

  clear(req: GenerationRequest): void {
    if (this.inFlight?.seq === req.seq) {
      this.inFlight = null;
    }
  }

  /** Invalidate any in-flight work (e.g. new doodle / source edit). */
  invalidateAll(): void {
    this.seq += 1;
    this.inFlight = null;
  }

  get current(): GenerationRequest | null {
    return this.inFlight;
  }
}

/**
 * Whether a completed transform result may merge into the current Creation.
 * Fingerprint/id mismatch → drop (edited doodle or different Creation).
 */
export function canApplyGeneratedAsset(opts: {
  request: GenerationRequest;
  currentCreationId: string;
  currentFingerprint: string;
}): boolean {
  if (opts.request.creationId !== opts.currentCreationId) return false;
  if (opts.request.fingerprint !== opts.currentFingerprint) return false;
  return true;
}
