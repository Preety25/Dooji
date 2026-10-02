/**
 * Library open / edit-draft entry semantics (pure helpers for tests).
 */
import type { Creation, GeneratedAsset, StyleId } from '../models/types';
import { lookupCachedAsset } from '../generation/cache';

export type OpenCreationDestination = 'canvas' | 'result';

export interface OpenCreationPlan {
  destination: OpenCreationDestination;
  phase: 'canvas' | 'result';
  activeAssetId: string | undefined;
  selectedStyle: StyleId | undefined;
  /** Opening for Canvas never starts an edit draft. */
  beginsEditDraft: false;
  dirty: false;
}

/**
 * Resolve how a Library Creation should open.
 * - Your doodle → Canvas, no active asset, not dirty
 * - Generated Dooji → Result for that asset
 */
export function planOpenCreation(
  creation: Creation,
  opts: {
    destination: OpenCreationDestination;
    assetId?: string;
  },
): OpenCreationPlan {
  if (opts.destination === 'canvas') {
    const meta = creation.metadata || {};
    return {
      destination: 'canvas',
      phase: 'canvas',
      activeAssetId: undefined,
      selectedStyle:
        typeof meta.lastSelectedStyle === 'string'
          ? (meta.lastSelectedStyle as StyleId)
          : undefined,
      beginsEditDraft: false,
      dirty: false,
    };
  }

  const meta = creation.metadata || {};
  const preferredId =
    opts.assetId ||
    (typeof meta.lastActiveAssetId === 'string'
      ? meta.lastActiveAssetId
      : undefined);
  const preferred = preferredId
    ? creation.assets.find((a) => a.id === preferredId)
    : undefined;
  const validPreferred =
    preferred &&
    lookupCachedAsset(creation, preferred.style)?.id === preferred.id
      ? preferred
      : undefined;
  const byRecency = [...creation.assets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  let fallback: GeneratedAsset | undefined;
  for (const a of byRecency) {
    if (lookupCachedAsset(creation, a.style)?.id === a.id) {
      fallback = a;
      break;
    }
  }
  const active = validPreferred || fallback;
  return {
    destination: 'result',
    phase: active ? 'result' : 'canvas',
    activeAssetId: active?.id,
    selectedStyle:
      active?.style ||
      (typeof meta.lastSelectedStyle === 'string'
        ? (meta.lastSelectedStyle as StyleId)
        : undefined),
    beginsEditDraft: false,
    dirty: false,
  };
}

/**
 * Whether opening a saved Creation for Canvas should show a leave guard.
 * Clean saved + not in draft → no guard.
 */
export function openSavedDoodleIsClean(opts: {
  saved: boolean;
  isEditDraft: boolean;
  dirty: boolean;
}): boolean {
  return opts.saved && !opts.isEditDraft && !opts.dirty;
}

/**
 * First stroke on a saved Creation (no baseline yet) begins an edit draft.
 */
export function shouldBeginEditDraftOnStroke(opts: {
  creationSaved: boolean;
  hasSavedBaseline: boolean;
}): boolean {
  return opts.creationSaved && !opts.hasSavedBaseline;
}

/** Library Delete uses design destructive red — not Canvas Clear / Discard. */
export const LIBRARY_DELETE_COLOR = '#FB4A52';
