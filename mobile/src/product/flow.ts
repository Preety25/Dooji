import type { Creation, GeneratedAsset, StyleId } from '../models/types';
import { STYLES } from '../models/types';
import { doodleFingerprint, lookupCachedAsset } from '../generation/cache';

export type AppPhase = 'canvas' | 'preview' | 'generating' | 'result';

/** Navigation destination the user attempted; Stay cancels only this attempt. */
export type LeaveIntent =
  | { type: 'new_doodle' }
  | { type: 'library' }
  | { type: 'open_creation'; id: string }
  | { type: 'back' };

export type GuardPromptKind =
  | 'none'
  | 'keep_unsaved'
  | 'abandon_edit_draft';

export interface GuardPrompt {
  kind: Exclude<GuardPromptKind, 'none'>;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  cancelLabel: string;
}

/** @deprecated Prefer GuardPrompt — kept for older test names. */
export type NewDoodlePromptKind =
  | 'none'
  | 'save_before_new'
  | 'save_changes'
  | 'keep_unsaved'
  | 'abandon_edit_draft';

export interface NewDoodlePrompt {
  kind: NewDoodlePromptKind;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  cancelLabel?: string;
}

/**
 * Make it routing:
 * - first generation of a new doodle → Preview
 * - established style + cache hit for current source → Result (reuse)
 * - established style + source changed / miss → regenerate remembered style (skip Preview)
 */
export type MakeItDecision =
  | { kind: 'noop' }
  | { kind: 'preview' }
  | { kind: 'reuse'; style: StyleId }
  | { kind: 'regenerate'; style: StyleId };

/** Preference/state only — not a generation. */
export function rememberedStyleOf(creation: Creation): StyleId | undefined {
  const meta = creation.metadata || {};
  if (typeof meta.lastSelectedStyle === 'string') {
    return meta.lastSelectedStyle as StyleId;
  }
  if (creation.assets.length > 0) return creation.style;
  return undefined;
}

/** True once the user has successfully generated at least one style for this Creation. */
export function hasEstablishedStyle(creation: Creation): boolean {
  return creation.assets.length > 0;
}

export function decideMakeIt(opts: {
  hasStrokes: boolean;
  established: boolean;
  remembered?: StyleId;
  cacheHitForRemembered: boolean;
}): MakeItDecision {
  if (!opts.hasStrokes) return { kind: 'noop' };
  if (!opts.established || !opts.remembered) return { kind: 'preview' };
  if (opts.cacheHitForRemembered) {
    return { kind: 'reuse', style: opts.remembered };
  }
  return { kind: 'regenerate', style: opts.remembered };
}

export const RATE_LIMITED_COPY =
  "You've reached your generation limit for now. Try again later.";
export const TECHNICAL_ERROR_TITLE = "Sorry, the magic isn't working";
export const TECHNICAL_ERROR_BODY =
  'Your doodle is safe. Want to give it another go?';
export const SEMANTIC_UNCERTAINTY_COPY =
  "We weren't totally sure what this was...";
export const REVEAL_CAPTION = 'Looking good 👀';
export const GENERATING_TITLE = 'Making it Dooji...';
export const GENERATING_SUB = 'Hang tight ... this takes a moment.';
export const CANVAS_CLEARED_TOAST = 'Canvas cleared.';
export const DISCARD_EDIT_TITLE = 'Discard changes?';
export const DISCARD_EDIT_BODY =
  'Your saved Dooji stays as it was. This edit will be lost.';

/**
 * Deep-clone a Creation for edit-draft baseline (JSON-safe fields only).
 */
export function cloneCreation(creation: Creation): Creation {
  return JSON.parse(JSON.stringify(creation)) as Creation;
}

/**
 * Assets valid for the Creation's current strokes/canvas fingerprint.
 * Avoids showing stale-fingerprint style cards in Library / Result.
 */
export function assetsForCurrentSource(creation: Creation): GeneratedAsset[] {
  const styles = STYLES.map((s) => s.id);
  const out: GeneratedAsset[] = [];
  for (const style of styles) {
    const hit = lookupCachedAsset(creation, style);
    if (hit) out.push(hit);
  }
  return out;
}

export function creationHasContent(creation: Creation): boolean {
  return creation.strokes.length > 0 || creation.assets.length > 0;
}

/**
 * Whether leaving the current session would abandon unsaved work.
 * Edit draft of a saved Creation is always guarded until Save changes.
 * Unsaved new Creation is guarded when it has content.
 */
export function evaluateNavigationGuard(opts: {
  isEditDraft: boolean;
  creation: Creation;
  dirty: boolean;
  hasContent: boolean;
}): GuardPromptKind {
  if (opts.isEditDraft) return 'abandon_edit_draft';
  if (!opts.hasContent) return 'none';
  if (!opts.creation.saved) return 'keep_unsaved';
  // Saved, not in edit draft, but dirty (shouldn't happen with draft model) — still guard.
  if (opts.dirty) return 'abandon_edit_draft';
  return 'none';
}

export function guardPromptFor(kind: GuardPromptKind): GuardPrompt | null {
  if (kind === 'none') return null;
  if (kind === 'keep_unsaved') {
    return {
      kind,
      title: 'Keep this doodle?',
      body: "It isn't saved yet. Starting something new will clear it.",
      primaryLabel: 'Save and leave',
      secondaryLabel: 'Discard and leave',
      cancelLabel: 'Stay',
    };
  }
  return {
    kind: 'abandon_edit_draft',
    title: 'Save your changes?',
    body: 'You have unsaved edits to this Dooji. Leaving will lose them unless you save.',
    primaryLabel: 'Save changes and leave',
    secondaryLabel: 'Discard changes and leave',
    cancelLabel: 'Stay',
  };
}

/**
 * New Doodle / leave evaluation — wraps {@link evaluateNavigationGuard}.
 * Maps to legacy kind names used by earlier tests where helpful.
 */
export function evaluateNewDoodle(opts: {
  creation: Creation;
  dirty: boolean;
  hasContent: boolean;
  isEditDraft?: boolean;
}): NewDoodlePrompt {
  const kind = evaluateNavigationGuard({
    isEditDraft: Boolean(opts.isEditDraft),
    creation: opts.creation,
    dirty: opts.dirty,
    hasContent: opts.hasContent,
  });
  const prompt = guardPromptFor(kind);
  if (!prompt) {
    return {
      kind: 'none',
      title: '',
      body: '',
      primaryLabel: '',
      secondaryLabel: '',
      cancelLabel: 'Stay',
    };
  }
  return {
    kind: prompt.kind,
    title: prompt.title,
    body: prompt.body,
    primaryLabel: prompt.primaryLabel,
    secondaryLabel: prompt.secondaryLabel,
    cancelLabel: prompt.cancelLabel,
  };
}

export function makeItCtaLabel(style: StyleId | undefined): string {
  if (!style) return 'Make it ✨';
  const label = STYLES.find((s) => s.id === style)?.label ?? style;
  return `Make it ${label} ✨`;
}

/** Playful random style — not “most apt”. */
export function pickSurpriseStyle(
  styles: readonly StyleId[] = STYLES.map((s) => s.id),
  random: () => number = Math.random,
): StyleId {
  const list = styles.length ? styles : (['gummy'] as StyleId[]);
  const idx = Math.floor(random() * list.length) % list.length;
  return list[idx]!;
}

/**
 * Explicit server-driven semantic uncertainty only.
 * Never invent client-side “weirdness” from the image.
 */
export function readSemanticUncertainty(
  metadata?: Record<string, unknown> | null,
): boolean {
  if (!metadata) return false;
  if (metadata.semantic_uncertain === true) return true;
  if (metadata.interpretation_uncertain === true) return true;
  const confidence = metadata.interpretation_confidence;
  if (confidence === 'low' || confidence === 'uncertain') return true;
  return false;
}

export function generationRequestKey(opts: {
  creationId: string;
  fingerprint: string;
  style: StyleId;
}): string {
  return `${opts.creationId}::${opts.fingerprint}::${opts.style}`;
}

/** True if two creations share the same doodle fingerprint. */
export function sameDoodleSource(a: Creation, b: Creation): boolean {
  return (
    doodleFingerprint(a.strokes, a.canvas) ===
    doodleFingerprint(b.strokes, b.canvas)
  );
}
