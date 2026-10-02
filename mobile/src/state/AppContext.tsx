import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { track } from '../analytics/events';
import {
  DoodleRasterCapture,
  type DoodleRasterHandle,
} from '../components/DoodleRasterCapture';
import { doodleFingerprint, lookupCachedAsset } from '../generation/cache';
import { ensureStyleAsset } from '../generation/ensure';
import { newId, nowIso } from '../lib/id';
import {
  DEFAULT_STYLE,
  latestAsset,
  type Creation,
  type DoodleStroke,
  type GeneratedAsset,
  type GenerationJob,
  type StyleId,
} from '../models/types';
import {
  RATE_LIMITED_COPY,
  canApplyGeneratedAsset,
  cloneCreation,
  creationHasContent,
  decideMakeIt,
  evaluateNavigationGuard,
  GenerationGuard,
  guardPromptFor,
  hasEstablishedStyle,
  makeItCtaLabel,
  pickSurpriseStyle,
  planOpenCreation,
  readSemanticUncertainty,
  rememberedStyleOf,
  type AppPhase,
  type GuardPrompt,
  type LeaveIntent,
} from '../product';
import { loadLibrary, removeCreation, upsertCreation } from '../storage/library';
import { getTransformClient } from '../transform';
import { PALETTE, brushSizes } from '../design/tokens';
import { getAnonymousClientId } from '../usage/anonymousId';
import { usage } from '../usage/entitlement';
import { transformDebug } from '../lib/transformDebug';

/** Snapshot captured when clearing a saved Creation canvas — Undo restores context. */
export interface ClearUndoSnapshot {
  creation: Creation;
  /** Present when clearing an edit draft; null when clearing a clean saved open. */
  savedBaseline: Creation | null;
  selectedStyle: StyleId | undefined;
  activeAssetId?: string;
  undoStack: DoodleStroke[][];
  redoStack: DoodleStroke[][];
}

interface AppState {
  ready: boolean;
  library: Creation[];
  /** Working Creation — live doodle or edit draft. */
  creation: Creation;
  /**
   * Immutable snapshot of the Library Creation while editing a saved doodle.
   * Null when not in edit-draft mode.
   */
  savedBaseline: Creation | null;
  phase: AppPhase;
  selectedStyle: StyleId | undefined;
  brushColor: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
  undoStack: DoodleStroke[][];
  redoStack: DoodleStroke[][];
  activeAssetId?: string;
  activeJob?: GenerationJob;
  generatingCopy: string;
  lastError?: string;
  semanticWarning: boolean;
  dirty: boolean;
  canvasLayout: { width: number; height: number };
  /** Leave / New-doodle navigation guard (Stay only cancels this attempt). */
  leavePrompt: GuardPrompt | null;
  pendingLeave: LeaveIntent | null;
  /** Confirm Discard changes on edit-draft Result. */
  discardConfirmVisible: boolean;
  /** Toast after Clear canvas. */
  canvasClearedToast: boolean;
  /**
   * When Clear exited an edit draft into a fresh canvas, Undo restores this.
   * Distinct from stroke undoStack.
   */
  clearUndoSnapshot: ClearUndoSnapshot | null;
}

type Action =
  | { type: 'hydrate'; library: Creation[] }
  | { type: 'set_tool'; tool: 'brush' | 'eraser' }
  | { type: 'set_color'; color: string }
  | { type: 'set_size'; size: number }
  | { type: 'add_stroke'; stroke: DoodleStroke }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear_new' }
  | {
      type: 'clear_exit_edit_draft';
      snapshot: ClearUndoSnapshot;
      fresh: Creation;
    }
  | { type: 'restore_clear_undo'; snapshot: ClearUndoSnapshot }
  | { type: 'dismiss_cleared_toast' }
  | { type: 'show_cleared_toast' }
  | { type: 'set_phase'; phase: AppPhase }
  | { type: 'set_selected_style'; style: StyleId | undefined }
  | { type: 'open_preview' }
  | {
      type: 'begin_generating';
      copy: string;
      style: StyleId;
      job: GenerationJob;
    }
  | {
      type: 'generation_ok';
      asset: GeneratedAsset;
      job: GenerationJob;
      creation: Creation;
      activate: boolean;
      semanticWarning: boolean;
    }
  | {
      type: 'cache_activate';
      style: StyleId;
      asset: GeneratedAsset;
    }
  | {
      type: 'generation_err';
      error: string;
      job: GenerationJob;
      creation: Creation;
    }
  | { type: 'clear_semantic_warning' }
  | { type: 'select_asset'; assetId: string; style: StyleId }
  | { type: 'mark_saved'; creation: Creation; library: Creation[] }
  | { type: 'set_library'; library: Creation[] }
  | {
      type: 'load_creation';
      creation: Creation;
      selectedStyle: StyleId | undefined;
      activeAssetId?: string;
    }
  | { type: 'new_doodle' }
  | { type: 'begin_edit_draft'; baseline: Creation }
  | { type: 'commit_edit_draft'; creation: Creation; library: Creation[] }
  | { type: 'restore_baseline'; baseline: Creation; activeAssetId?: string }
  | { type: 'set_leave_prompt'; prompt: GuardPrompt | null; intent: LeaveIntent | null }
  | { type: 'set_discard_confirm'; visible: boolean }
  | { type: 'replace_creation'; creation: Creation }
  | { type: 'set_canvas_layout'; width: number; height: number }
  | { type: 'merge_creation'; creation: Creation }
  | { type: 'clear_error' };

const BRUSH_COLORS = [...PALETTE];
const COPIES = ['Making it Dooji...'];

function withRememberedStyle(creation: Creation, style: StyleId): Creation {
  return {
    ...creation,
    style,
    metadata: {
      ...(creation.metadata || {}),
      lastSelectedStyle: style,
    },
  };
}

function emptyCreation(): Creation {
  const t = nowIso();
  return {
    id: newId('creation'),
    strokes: [],
    canvas: { width: 1080, height: 1080 },
    style: DEFAULT_STYLE,
    assets: [],
    jobs: [],
    saved: false,
    createdAt: t,
    updatedAt: t,
  };
}

function initialState(): AppState {
  return {
    ready: false,
    library: [],
    creation: emptyCreation(),
    savedBaseline: null,
    phase: 'canvas',
    selectedStyle: undefined,
    brushColor: BRUSH_COLORS[0],
    brushSize: brushSizes[1],
    tool: 'brush',
    undoStack: [],
    redoStack: [],
    generatingCopy: 'Understanding your doodle…',
    semanticWarning: false,
    dirty: false,
    canvasLayout: { width: 1080, height: 1080 },
    leavePrompt: null,
    pendingLeave: null,
    discardConfirmVisible: false,
    canvasClearedToast: false,
    clearUndoSnapshot: null,
  };
}

function activeStillValid(
  creation: Creation,
  activeAssetId: string | undefined,
): string | undefined {
  if (!activeAssetId) return undefined;
  const asset = creation.assets.find((a) => a.id === activeAssetId);
  if (!asset) return undefined;
  const valid = lookupCachedAsset(creation, asset.style);
  return valid?.id === asset.id ? activeAssetId : undefined;
}

function ensureDraftOnMutate(state: AppState): Partial<AppState> {
  if (state.savedBaseline) return {};
  if (!state.creation.saved) return {};
  // First mutation on a saved Creation → enter edit draft.
  return {
    savedBaseline: cloneCreation(state.creation),
    dirty: true,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ready: true, library: action.library };
    case 'set_tool':
      return { ...state, tool: action.tool };
    case 'set_color':
      return { ...state, brushColor: action.color, tool: 'brush' };
    case 'set_size':
      return { ...state, brushSize: action.size };
    case 'add_stroke': {
      const draftBits = ensureDraftOnMutate(state);
      const creation = {
        ...state.creation,
        strokes: [...state.creation.strokes, action.stroke],
        updatedAt: nowIso(),
      };
      return {
        ...state,
        ...draftBits,
        creation,
        undoStack: [...state.undoStack, state.creation.strokes],
        redoStack: [],
        dirty: true,
        clearUndoSnapshot: null,
        lastError: undefined,
        semanticWarning: false,
        activeAssetId: activeStillValid(creation, state.activeAssetId),
      };
    }
    case 'undo': {
      if (state.clearUndoSnapshot && !state.undoStack.length) {
        // Handled via restore_clear_undo action from UI.
        return state;
      }
      if (!state.undoStack.length) return state;
      const draftBits = ensureDraftOnMutate(state);
      const prev = state.undoStack[state.undoStack.length - 1];
      const creation = {
        ...state.creation,
        strokes: prev,
        updatedAt: nowIso(),
      };
      return {
        ...state,
        ...draftBits,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.creation.strokes],
        creation,
        dirty: true,
        activeAssetId: activeStillValid(creation, state.activeAssetId),
        semanticWarning: false,
      };
    }
    case 'redo': {
      if (!state.redoStack.length) return state;
      const draftBits = ensureDraftOnMutate(state);
      const next = state.redoStack[state.redoStack.length - 1];
      const creation = {
        ...state.creation,
        strokes: next,
        updatedAt: nowIso(),
      };
      return {
        ...state,
        ...draftBits,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.creation.strokes],
        creation,
        dirty: true,
        activeAssetId: activeStillValid(creation, state.activeAssetId),
        semanticWarning: false,
      };
    }
    case 'clear_new': {
      if (!state.creation.strokes.length) return state;
      const creation = {
        ...state.creation,
        strokes: [],
        updatedAt: nowIso(),
      };
      return {
        ...state,
        undoStack: [...state.undoStack, state.creation.strokes],
        redoStack: [],
        creation,
        dirty: state.creation.saved ? state.dirty : true,
        canvasClearedToast: true,
        clearUndoSnapshot: null,
        activeAssetId: activeStillValid(creation, state.activeAssetId),
        semanticWarning: false,
      };
    }
    case 'clear_exit_edit_draft': {
      return {
        ...state,
        creation: action.fresh,
        savedBaseline: null,
        phase: 'canvas',
        selectedStyle: undefined,
        activeAssetId: undefined,
        activeJob: undefined,
        undoStack: [],
        redoStack: [],
        dirty: false,
        clearUndoSnapshot: action.snapshot,
        canvasClearedToast: true,
        lastError: undefined,
        semanticWarning: false,
        leavePrompt: null,
        pendingLeave: null,
        discardConfirmVisible: false,
      };
    }
    case 'restore_clear_undo': {
      const s = action.snapshot;
      return {
        ...state,
        creation: s.creation,
        savedBaseline: s.savedBaseline,
        phase: 'canvas',
        selectedStyle: s.selectedStyle,
        activeAssetId: s.activeAssetId,
        undoStack: s.undoStack,
        redoStack: s.redoStack,
        // Dirty only when restoring an edit draft; clean saved open stays clean.
        dirty: Boolean(s.savedBaseline),
        clearUndoSnapshot: null,
        canvasClearedToast: false,
      };
    }
    case 'show_cleared_toast':
      return { ...state, canvasClearedToast: true };
    case 'dismiss_cleared_toast':
      return { ...state, canvasClearedToast: false };
    case 'set_phase':
      return {
        ...state,
        phase: action.phase,
        lastError: action.phase === 'canvas' ? undefined : state.lastError,
      };
    case 'set_selected_style':
      return { ...state, selectedStyle: action.style };
    case 'open_preview':
      return {
        ...state,
        phase: 'preview',
        selectedStyle: undefined,
        lastError: undefined,
        semanticWarning: false,
      };
    case 'begin_generating':
      return {
        ...state,
        phase: 'generating',
        generatingCopy: action.copy,
        selectedStyle: action.style,
        activeJob: action.job,
        lastError: undefined,
        semanticWarning: false,
        creation: {
          ...state.creation,
          jobs: [...state.creation.jobs.filter((j) => j.id !== action.job.id), action.job],
          updatedAt: nowIso(),
        },
      };
    case 'generation_ok': {
      const next: AppState = {
        ...state,
        creation: action.creation,
        activeJob: undefined,
        // Edit draft stays dirty until Save changes; unsaved new stays dirty until Save.
        dirty: true,
        lastError: undefined,
        semanticWarning: action.semanticWarning,
      };
      if (action.activate) {
        next.phase = 'result';
        next.activeAssetId = action.asset.id;
        next.selectedStyle = action.asset.style;
      }
      return next;
    }
    case 'cache_activate':
      return {
        ...state,
        phase: 'result',
        selectedStyle: action.style,
        activeAssetId: action.asset.id,
        lastError: undefined,
        semanticWarning: false,
        activeJob: undefined,
      };
    case 'generation_err':
      return {
        ...state,
        phase: 'generating',
        lastError: action.error,
        semanticWarning: false,
        activeJob: undefined,
        creation: action.creation,
      };
    case 'clear_semantic_warning':
      return { ...state, semanticWarning: false };
    case 'select_asset':
      return {
        ...state,
        activeAssetId: action.assetId,
        selectedStyle: action.style,
        phase: 'result',
        lastError: undefined,
      };
    case 'mark_saved':
      return {
        ...state,
        creation: action.creation,
        library: action.library,
        dirty: false,
        savedBaseline: null,
      };
    case 'set_library':
      return { ...state, library: action.library };
    case 'load_creation':
      return {
        ...state,
        creation: action.creation,
        savedBaseline: null,
        phase: action.activeAssetId ? 'result' : 'canvas',
        selectedStyle: action.selectedStyle,
        activeAssetId: action.activeAssetId,
        undoStack: [],
        redoStack: [],
        dirty: false,
        lastError: undefined,
        semanticWarning: false,
        activeJob: undefined,
        leavePrompt: null,
        pendingLeave: null,
        discardConfirmVisible: false,
        clearUndoSnapshot: null,
        canvasClearedToast: false,
      };
    case 'new_doodle':
      return {
        ...state,
        creation: emptyCreation(),
        savedBaseline: null,
        phase: 'canvas',
        selectedStyle: undefined,
        undoStack: [],
        redoStack: [],
        activeAssetId: undefined,
        activeJob: undefined,
        dirty: false,
        lastError: undefined,
        semanticWarning: false,
        leavePrompt: null,
        pendingLeave: null,
        discardConfirmVisible: false,
        clearUndoSnapshot: null,
        canvasClearedToast: false,
      };
    case 'begin_edit_draft':
      return {
        ...state,
        savedBaseline: action.baseline,
        dirty: true,
        phase: 'canvas',
        clearUndoSnapshot: null,
      };
    case 'commit_edit_draft':
      return {
        ...state,
        creation: action.creation,
        library: action.library,
        savedBaseline: null,
        dirty: false,
        discardConfirmVisible: false,
        leavePrompt: null,
        pendingLeave: null,
      };
    case 'restore_baseline': {
      const baseline = action.baseline;
      return {
        ...state,
        creation: baseline,
        savedBaseline: null,
        dirty: false,
        phase: action.activeAssetId || baseline.assets.length ? 'result' : 'canvas',
        activeAssetId: action.activeAssetId,
        selectedStyle:
          (action.activeAssetId
            ? baseline.assets.find((a) => a.id === action.activeAssetId)?.style
            : undefined) || baseline.style,
        undoStack: [],
        redoStack: [],
        discardConfirmVisible: false,
        leavePrompt: null,
        pendingLeave: null,
        clearUndoSnapshot: null,
        lastError: undefined,
        semanticWarning: false,
      };
    }
    case 'set_leave_prompt':
      return {
        ...state,
        leavePrompt: action.prompt,
        pendingLeave: action.intent,
      };
    case 'set_discard_confirm':
      return { ...state, discardConfirmVisible: action.visible };
    case 'replace_creation':
      return { ...state, creation: action.creation };
    case 'merge_creation':
      return {
        ...state,
        creation: action.creation,
        dirty: true,
      };
    case 'set_canvas_layout': {
      // Ignore 0×0 (and other non-positive) layouts — native/web often emit
      // these on unmount when leaving Canvas for Preview/Generating.
      // Accepting them wiped creation.canvas and broke fingerprint apply.
      if (!(action.width > 0 && action.height > 0)) {
        return state;
      }
      return {
        ...state,
        canvasLayout: { width: action.width, height: action.height },
        creation: {
          ...state.creation,
          canvas: { width: action.width, height: action.height },
        },
      };
    }
    case 'clear_error':
      return { ...state, lastError: undefined };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  brushColors: string[];
  activeAsset?: GeneratedAsset;
  hasStrokes: boolean;
  canUndo: boolean;
  canRedo: boolean;
  createCtaLabel: string;
  selectedStyleIsGenerated: boolean;
  /** True while editing a saved Creation (baseline held separately). */
  isEditDraft: boolean;
  setTool: (tool: 'brush' | 'eraser') => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  addStroke: (stroke: DoodleStroke) => void;
  setCanvasLayout: (size: { width: number; height: number }) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  dismissClearedToast: () => void;
  openPreview: () => void;
  makeIt: () => void;
  closePreview: () => void;
  selectStyle: (style: StyleId) => void;
  surpriseMe: () => void;
  createSelectedStyle: () => Promise<void>;
  editDoodle: () => void;
  /** Explicit Library save for a new Creation (or commit when not in draft). */
  saveCreation: () => Promise<void>;
  /** Commit edit draft → Library. */
  saveChanges: () => Promise<void>;
  requestDiscardChanges: () => void;
  confirmDiscardChanges: () => void;
  cancelDiscardChanges: () => void;
  /**
   * Navigation guard. Returns true if the caller may proceed immediately.
   * Otherwise shows a prompt; on Save/Discard leave, `onProceed` runs.
   */
  requestLeave: (intent: LeaveIntent, onProceed: () => void) => boolean;
  confirmLeave: (action: 'save' | 'discard' | 'stay') => Promise<void>;
  /** @deprecated use requestLeave — kept for soft migration in screens. */
  requestNewDoodle: () => void;
  confirmNewDoodle: (action: 'save' | 'discard' | 'cancel') => Promise<void>;
  openCreation: (
    id: string,
    opts?: { destination?: 'canvas' | 'result'; assetId?: string },
  ) => void;
  deleteCreation: (id: string) => Promise<void>;
  dismissError: () => void;
  dismissSemanticWarning: () => void;
  retryTransform: () => Promise<void>;
  shareCurrent: () => Promise<string | undefined>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const rasterRef = useRef<DoodleRasterHandle>(null);
  const creationRef = useRef(state.creation);
  const layoutRef = useRef(state.canvasLayout);
  const selectedStyleRef = useRef(state.selectedStyle);
  const phaseRef = useRef(state.phase);
  const baselineRef = useRef(state.savedBaseline);
  const dirtyRef = useRef(state.dirty);
  const clearUndoRef = useRef(state.clearUndoSnapshot);
  const guardRef = useRef(new GenerationGuard());
  const pendingProceedRef = useRef<(() => void) | null>(null);

  creationRef.current = state.creation;
  layoutRef.current = state.canvasLayout;
  selectedStyleRef.current = state.selectedStyle;
  phaseRef.current = state.phase;
  baselineRef.current = state.savedBaseline;
  dirtyRef.current = state.dirty;
  clearUndoRef.current = state.clearUndoSnapshot;

  useEffect(() => {
    track('app_open');
    void loadLibrary().then((library) => dispatch({ type: 'hydrate', library }));
  }, []);

  useEffect(() => {
    if (state.creation.strokes.length === 1 && state.undoStack.length === 0) {
      track('canvas_started');
    }
  }, [state.creation.strokes.length, state.undoStack.length]);

  useEffect(() => {
    if (!state.canvasClearedToast) return;
    const t = setTimeout(() => dispatch({ type: 'dismiss_cleared_toast' }), 4000);
    return () => clearTimeout(t);
  }, [state.canvasClearedToast]);

  const runCreateStyle = useCallback(
    async (style: StyleId, reason: 'create' | 'retry') => {
      const creation = creationRef.current;
      const layout = layoutRef.current;
      // Prefer last positive layout; never treat 0 as a valid canvas size.
      const canvas = {
        width:
          layout.width > 0
            ? layout.width
            : creation.canvas.width > 0
              ? creation.canvas.width
              : 1080,
        height:
          layout.height > 0
            ? layout.height
            : creation.canvas.height > 0
              ? creation.canvas.height
              : 1080,
      };
      const fingerprint = doodleFingerprint(creation.strokes, canvas);
      const client = getTransformClient();

      const cached = lookupCachedAsset(creation, style);
      if (cached) {
        transformDebug('cache-hit-activate', {
          style,
          assetId: cached.id,
        });
        track('create_style_clicked', { style, cache: true });
        track('style_cache_hit', { style });
        dispatch({ type: 'cache_activate', style, asset: cached });
        return;
      }

      track('create_style_clicked', { style, cache: false });

      const entitlement = usage.can('transform');
      if (!entitlement.allowed) {
        transformDebug('entitlement-blocked');
        dispatch({
          type: 'generation_err',
          error: RATE_LIMITED_COPY,
          job: {
            id: newId('job'),
            creationId: creation.id,
            style,
            status: 'failed',
            startedAt: nowIso(),
            finishedAt: nowIso(),
            error: 'entitlement',
          },
          creation,
        });
        return;
      }

      void getAnonymousClientId();

      const req = guardRef.current.begin({
        creationId: creation.id,
        fingerprint,
        style,
      });
      if (!req) {
        transformDebug('guard-duplicate-skip', {
          style,
          fingerprint,
        });
        return;
      }

      const job: GenerationJob = {
        id: newId('job'),
        creationId: creation.id,
        style,
        status: 'running',
        startedAt: nowIso(),
      };
      const copy = COPIES[Math.floor(Math.random() * COPIES.length)];
      transformDebug('generation-job-started', {
        jobId: job.id,
        style,
        reason,
        fingerprint,
        seq: req.seq,
        canvas,
      });
      dispatch({ type: 'begin_generating', copy, style, job });
      track('transform_started', { style, reason });

      const result = await ensureStyleAsset({
        creation: creationRef.current,
        style,
        canvas,
        client,
        rasterize: async () => {
          if (!rasterRef.current) throw new Error('raster_surface_missing');
          transformDebug('rasterize-invoke');
          const hangTimer = setTimeout(() => {
            transformDebug('rasterize-still-pending', { ms: 4000 });
          }, 4000);
          try {
            const b64 = await rasterRef.current.capturePngBase64();
            if (!b64) throw new Error('raster_capture_empty');
            return b64;
          } finally {
            clearTimeout(hangTimer);
          }
        },
        generateIfMissing: true,
        reason: reason === 'retry' ? 'retry' : 'make',
      });

      transformDebug('ensure-complete', {
        kind: result.kind,
        style,
        assetUri:
          result.kind === 'generated' || result.kind === 'cache_hit'
            ? result.asset.imageUri?.slice(0, 80)
            : undefined,
        error: result.kind === 'error' ? result.error : undefined,
      });

      const currentFp = doodleFingerprint(creationRef.current.strokes, {
        width:
          layoutRef.current.width > 0
            ? layoutRef.current.width
            : creationRef.current.canvas.width > 0
              ? creationRef.current.canvas.width
              : canvas.width,
        height:
          layoutRef.current.height > 0
            ? layoutRef.current.height
            : creationRef.current.canvas.height > 0
              ? creationRef.current.canvas.height
              : canvas.height,
      });
      const applicable = canApplyGeneratedAsset({
        request: req,
        currentCreationId: creationRef.current.id,
        currentFingerprint: currentFp,
      });

      if (!applicable) {
        transformDebug('apply-blocked-fingerprint', {
          requestFp: req.fingerprint,
          currentFp,
          requestId: req.creationId,
          currentId: creationRef.current.id,
          phase: phaseRef.current,
        });
        // Must leave Generating — silent return left activeJob running forever.
        if (guardRef.current.isCurrent(req)) {
          dispatch({
            type: 'generation_err',
            error: "Sorry, the magic isn't working",
            job: {
              id: newId('job'),
              creationId: creationRef.current.id,
              style,
              status: 'failed',
              startedAt: job.startedAt,
              finishedAt: nowIso(),
              error: 'stale_fingerprint',
            },
            creation: creationRef.current,
          });
        }
        guardRef.current.clear(req);
        return;
      }

      if (result.kind === 'cache_hit') {
        track('style_cache_hit', { style });
        if (guardRef.current.isCurrent(req)) {
          transformDebug('cache-hit-activate-after-ensure');
          dispatch({ type: 'cache_activate', style, asset: result.asset });
        } else {
          transformDebug('cache-hit-stale-merge');
          dispatch({ type: 'merge_creation', creation: result.creation });
        }
        guardRef.current.clear(req);
        return;
      }

      if (result.kind === 'generated') {
        usage.record('transform');
        track('transform_succeeded', { style });
        const semanticWarning = readSemanticUncertainty(result.asset.metadata);
        const activate = guardRef.current.isCurrent(req);
        const remembered = withRememberedStyle(result.creation, style);
        creationRef.current = remembered;

        const startedMs = Date.parse(job.startedAt) || Date.now();
        const minMotionMs = 2500;
        const elapsedMs = Date.now() - startedMs;
        const waitMs = Math.max(0, minMotionMs - elapsedMs);
        transformDebug('result-ready', {
          assetId: result.asset.id,
          uri: result.asset.imageUri?.slice(0, 80),
          activate,
          elapsedMs,
          waitMs,
          provider: result.result.provider,
        });
        if (waitMs > 0) {
          transformDebug('motion-gate-wait', { waitMs });
          await new Promise((r) => setTimeout(r, waitMs));
        }
        transformDebug('motion-gate-elapsed', {
          totalMs: Date.now() - startedMs,
          isCurrent: guardRef.current.isCurrent(req),
        });
        if (!guardRef.current.isCurrent(req)) {
          transformDebug('motion-gate-stale-skip-nav', {
            phase: phaseRef.current,
          });
          dispatch({ type: 'merge_creation', creation: remembered });
          guardRef.current.clear(req);
          return;
        }

        transformDebug('generation-ok-dispatch', {
          activate,
          phaseBefore: phaseRef.current,
          assetId: result.asset.id,
        });
        dispatch({
          type: 'generation_ok',
          asset: result.asset,
          job: result.job,
          creation: remembered,
          activate,
          semanticWarning,
        });
        // Persist new style variants for an already-saved Creation,
        // but NEVER while an edit draft is open (Save changes is explicit).
        if (remembered.saved && !baselineRef.current) {
          const library = await upsertCreation(remembered);
          dispatch({ type: 'mark_saved', creation: remembered, library });
        }
        guardRef.current.clear(req);
        return;
      }

      const rateLimited =
        result.error === 'rate_limited' ||
        (result.transformCalled &&
          typeof result.error === 'string' &&
          result.error.includes('rate'));
      const errCopy = rateLimited
        ? RATE_LIMITED_COPY
        : "Sorry, the magic isn't working";
      track('transform_failed', { style, error: result.error });
      transformDebug('generation-err', {
        error: result.error,
        rateLimited,
        isCurrent: guardRef.current.isCurrent(req),
      });
      if (guardRef.current.isCurrent(req)) {
        creationRef.current = result.creation;
        dispatch({
          type: 'generation_err',
          error: errCopy,
          job: result.job,
          creation: result.creation,
        });
      }
      guardRef.current.clear(req);
    },
    [],
  );

  const commitWorkingCreation = useCallback(async () => {
    const saved: Creation = {
      ...creationRef.current,
      saved: true,
      updatedAt: nowIso(),
      metadata: {
        ...(creationRef.current.metadata || {}),
        lastActiveAssetId: state.activeAssetId ?? null,
        lastSelectedStyle: selectedStyleRef.current ?? null,
      },
    };
    const library = await upsertCreation(saved);
    usage.record('save');
    track('saved', { id: saved.id });
    creationRef.current = saved;
    if (baselineRef.current) {
      dispatch({ type: 'commit_edit_draft', creation: saved, library });
    } else {
      dispatch({ type: 'mark_saved', creation: saved, library });
    }
  }, [state.activeAssetId]);

  const restoreBaseline = useCallback(() => {
    const baseline = baselineRef.current;
    if (!baseline) return;
    const preferredId =
      typeof baseline.metadata?.lastActiveAssetId === 'string'
        ? baseline.metadata.lastActiveAssetId
        : undefined;
    const preferred = preferredId
      ? baseline.assets.find((a) => a.id === preferredId)
      : undefined;
    const validPreferred =
      preferred && lookupCachedAsset(baseline, preferred.style)?.id === preferred.id
        ? preferred
        : undefined;
    const fallback = latestAsset(baseline);
    const active =
      validPreferred ||
      (fallback && lookupCachedAsset(baseline, fallback.style)) ||
      undefined;
    creationRef.current = baseline;
    guardRef.current.invalidateAll();
    dispatch({
      type: 'restore_baseline',
      baseline,
      activeAssetId: active?.id,
    });
  }, []);

  const executeLeaveIntent = useCallback((intent: LeaveIntent | null) => {
    const proceed = pendingProceedRef.current;
    pendingProceedRef.current = null;
    dispatch({ type: 'set_leave_prompt', prompt: null, intent: null });
    if (proceed) {
      proceed();
      return;
    }
    if (!intent) return;
    if (intent.type === 'new_doodle' || intent.type === 'back') {
      track('new_doodle');
      guardRef.current.invalidateAll();
      dispatch({ type: 'new_doodle' });
    }
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const activeAsset =
      state.creation.assets.find((a) => a.id === state.activeAssetId) || undefined;

    const selectedCached = state.selectedStyle
      ? lookupCachedAsset(state.creation, state.selectedStyle)
      : undefined;
    const resolvedActive =
      activeAsset ||
      (state.phase === 'result' ? selectedCached || latestAsset(state.creation) : undefined);

    const editDraft = Boolean(state.savedBaseline);

    return {
      ...state,
      brushColors: BRUSH_COLORS,
      activeAsset: resolvedActive,
      hasStrokes: state.creation.strokes.length > 0,
      canUndo: state.undoStack.length > 0 || Boolean(state.clearUndoSnapshot),
      canRedo: state.redoStack.length > 0,
      createCtaLabel: makeItCtaLabel(state.selectedStyle),
      selectedStyleIsGenerated: Boolean(selectedCached),
      isEditDraft: editDraft,
      setTool: (tool) => dispatch({ type: 'set_tool', tool }),
      setColor: (color) => dispatch({ type: 'set_color', color }),
      setSize: (size) => dispatch({ type: 'set_size', size }),
      addStroke: (stroke) => {
        guardRef.current.invalidateAll();
        dispatch({ type: 'add_stroke', stroke });
      },
      setCanvasLayout: ({ width, height }) =>
        dispatch({ type: 'set_canvas_layout', width, height }),
      undo: () => {
        if (clearUndoRef.current && !state.undoStack.length) {
          dispatch({ type: 'restore_clear_undo', snapshot: clearUndoRef.current });
          return;
        }
        guardRef.current.invalidateAll();
        dispatch({ type: 'undo' });
      },
      redo: () => {
        guardRef.current.invalidateAll();
        dispatch({ type: 'redo' });
      },
      clearCanvas: () => {
        guardRef.current.invalidateAll();
        const baseline = baselineRef.current;
        const creation = creationRef.current;
        // Saved Creation Clear (draft or clean open): leave Library untouched,
        // exit to a fresh empty canvas; Undo restores the prior canvas context.
        if (baseline || creation.saved) {
          const snapshot: ClearUndoSnapshot = {
            creation: cloneCreation(creation),
            savedBaseline: baseline ? cloneCreation(baseline) : null,
            selectedStyle: selectedStyleRef.current,
            activeAssetId: state.activeAssetId,
            undoStack: state.undoStack,
            redoStack: state.redoStack,
          };
          const fresh = emptyCreation();
          creationRef.current = fresh;
          dispatch({ type: 'clear_exit_edit_draft', snapshot, fresh });
          return;
        }
        if (!creation.strokes.length) return;
        dispatch({ type: 'clear_new' });
      },
      dismissClearedToast: () => dispatch({ type: 'dismiss_cleared_toast' }),
      openPreview: () => {
        const creation = creationRef.current;
        if (!creation.strokes.length) return;
        track('doodle_completed');
        const remembered = rememberedStyleOf(creation);
        const cached = remembered
          ? lookupCachedAsset(creation, remembered)
          : undefined;
        const decision = decideMakeIt({
          hasStrokes: creation.strokes.length > 0,
          established: hasEstablishedStyle(creation),
          remembered,
          cacheHitForRemembered: Boolean(cached),
        });
        if (decision.kind === 'noop') return;
        if (decision.kind === 'preview') {
          dispatch({ type: 'open_preview' });
          track('preview_viewed');
          return;
        }
        if (decision.kind === 'reuse' && cached) {
          track('style_cache_hit', { style: decision.style });
          dispatch({
            type: 'cache_activate',
            style: decision.style,
            asset: cached,
          });
          return;
        }
        void runCreateStyle(decision.style, 'create');
      },
      makeIt: () => {
        const creation = creationRef.current;
        if (!creation.strokes.length) return;
        track('doodle_completed');
        const remembered = rememberedStyleOf(creation);
        const cached = remembered
          ? lookupCachedAsset(creation, remembered)
          : undefined;
        const decision = decideMakeIt({
          hasStrokes: creation.strokes.length > 0,
          established: hasEstablishedStyle(creation),
          remembered,
          cacheHitForRemembered: Boolean(cached),
        });
        if (decision.kind === 'noop') return;
        if (decision.kind === 'preview') {
          dispatch({ type: 'open_preview' });
          track('preview_viewed');
          return;
        }
        if (decision.kind === 'reuse' && cached) {
          track('style_cache_hit', { style: decision.style });
          dispatch({
            type: 'cache_activate',
            style: decision.style,
            asset: cached,
          });
          return;
        }
        void runCreateStyle(decision.style, 'create');
      },
      closePreview: () => {
        dispatch({ type: 'set_phase', phase: 'canvas' });
      },
      selectStyle: (style) => {
        track('style_selected', { style });
        const phase = phaseRef.current;
        if (phase === 'preview') {
          dispatch({ type: 'set_selected_style', style });
          void runCreateStyle(style, 'create');
          return;
        }
        if (phase === 'result') {
          const cached = lookupCachedAsset(creationRef.current, style);
          if (cached) {
            dispatch({ type: 'select_asset', assetId: cached.id, style });
            return;
          }
          dispatch({ type: 'set_selected_style', style });
          return;
        }
        dispatch({ type: 'set_selected_style', style });
      },
      surpriseMe: () => {
        const style = pickSurpriseStyle();
        track('surprise_me_selected', { style });
        dispatch({ type: 'set_selected_style', style });
        void runCreateStyle(style, 'create');
      },
      createSelectedStyle: async () => {
        const style = selectedStyleRef.current;
        if (!style) return;
        await runCreateStyle(style, 'create');
      },
      editDoodle: () => {
        track('edit_doodle');
        // Open Canvas on the saved source without starting a dirty draft.
        // First stroke mutation begins edit-draft via ensureDraftOnMutate.
        dispatch({ type: 'set_phase', phase: 'canvas' });
      },
      saveCreation: async () => {
        await commitWorkingCreation();
      },
      saveChanges: async () => {
        await commitWorkingCreation();
      },
      requestDiscardChanges: () => {
        if (!baselineRef.current) return;
        dispatch({ type: 'set_discard_confirm', visible: true });
      },
      confirmDiscardChanges: () => {
        restoreBaseline();
      },
      cancelDiscardChanges: () => {
        dispatch({ type: 'set_discard_confirm', visible: false });
      },
      requestLeave: (intent, onProceed) => {
        const kind = evaluateNavigationGuard({
          isEditDraft: Boolean(baselineRef.current),
          creation: creationRef.current,
          dirty: dirtyRef.current || Boolean(baselineRef.current),
          hasContent: creationHasContent(creationRef.current),
        });
        if (kind === 'none') {
          onProceed();
          return true;
        }
        const prompt = guardPromptFor(kind);
        pendingProceedRef.current = onProceed;
        dispatch({ type: 'set_leave_prompt', prompt, intent });
        return false;
      },
      confirmLeave: async (action) => {
        if (action === 'stay') {
          pendingProceedRef.current = null;
          dispatch({ type: 'set_leave_prompt', prompt: null, intent: null });
          return;
        }
        const intent = state.pendingLeave;
        if (action === 'save') {
          await commitWorkingCreation();
          executeLeaveIntent(intent);
          return;
        }
        // discard
        if (baselineRef.current) {
          restoreBaseline();
          const proceed = pendingProceedRef.current;
          pendingProceedRef.current = null;
          dispatch({ type: 'set_leave_prompt', prompt: null, intent: null });
          proceed?.();
          return;
        }
        // Unsaved new — abandon working Creation, then proceed.
        guardRef.current.invalidateAll();
        const proceed = pendingProceedRef.current;
        pendingProceedRef.current = null;
        dispatch({ type: 'new_doodle' });
        proceed?.();
      },
      requestNewDoodle: () => {
        const kind = evaluateNavigationGuard({
          isEditDraft: Boolean(baselineRef.current),
          creation: creationRef.current,
          dirty: dirtyRef.current || Boolean(baselineRef.current),
          hasContent: creationHasContent(creationRef.current),
        });
        if (kind === 'none') {
          track('new_doodle');
          guardRef.current.invalidateAll();
          dispatch({ type: 'new_doodle' });
          return;
        }
        const prompt = guardPromptFor(kind);
        pendingProceedRef.current = () => {
          track('new_doodle');
          guardRef.current.invalidateAll();
          dispatch({ type: 'new_doodle' });
        };
        dispatch({
          type: 'set_leave_prompt',
          prompt,
          intent: { type: 'new_doodle' },
        });
      },
      confirmNewDoodle: async (action) => {
        if (action === 'cancel') {
          pendingProceedRef.current = null;
          dispatch({ type: 'set_leave_prompt', prompt: null, intent: null });
          return;
        }
        if (action === 'save') {
          await commitWorkingCreation();
          executeLeaveIntent(state.pendingLeave);
          return;
        }
        if (baselineRef.current) {
          restoreBaseline();
          const proceed = pendingProceedRef.current;
          pendingProceedRef.current = null;
          dispatch({ type: 'set_leave_prompt', prompt: null, intent: null });
          proceed?.();
          return;
        }
        guardRef.current.invalidateAll();
        const proceed = pendingProceedRef.current;
        pendingProceedRef.current = null;
        dispatch({ type: 'new_doodle' });
        proceed?.();
      },
      openCreation: (id, opts) => {
        const destination = opts?.destination ?? 'result';
        const proceed = () => {
          const found = state.library.find((c) => c.id === id);
          if (!found) return;
          const plan = planOpenCreation(found, {
            destination,
            assetId: opts?.assetId,
          });
          guardRef.current.invalidateAll();
          dispatch({
            type: 'load_creation',
            creation: found,
            selectedStyle: plan.selectedStyle,
            activeAssetId: plan.activeAssetId,
          });
        };
        const kind = evaluateNavigationGuard({
          isEditDraft: Boolean(baselineRef.current),
          creation: creationRef.current,
          dirty: dirtyRef.current || Boolean(baselineRef.current),
          hasContent: creationHasContent(creationRef.current),
        });
        if (kind === 'none') {
          proceed();
          return;
        }
        const prompt = guardPromptFor(kind);
        pendingProceedRef.current = proceed;
        dispatch({
          type: 'set_leave_prompt',
          prompt,
          intent: { type: 'open_creation', id },
        });
      },
      deleteCreation: async (id) => {
        const library = await removeCreation(id);
        dispatch({ type: 'set_library', library });
        if (creationRef.current.id === id) {
          guardRef.current.invalidateAll();
          dispatch({ type: 'new_doodle' });
        }
      },
      dismissError: () => dispatch({ type: 'clear_error' }),
      dismissSemanticWarning: () => dispatch({ type: 'clear_semantic_warning' }),
      retryTransform: async () => {
        const style =
          selectedStyleRef.current ||
          creationRef.current.assets.find((a) => a.id === state.activeAssetId)?.style;
        if (!style) return;
        await runCreateStyle(style, 'retry');
      },
      shareCurrent: async () => {
        const asset =
          creationRef.current.assets.find((a) => a.id === state.activeAssetId) ||
          (selectedStyleRef.current
            ? lookupCachedAsset(creationRef.current, selectedStyleRef.current)
            : undefined);
        if (!asset) return undefined;
        usage.record('share');
        track('shared', { style: asset.style });
        return asset.imageUri;
      },
    };
  }, [state, runCreateStyle, commitWorkingCreation, restoreBaseline, executeLeaveIntent]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <DoodleRasterCapture
        ref={rasterRef}
        strokes={state.creation.strokes}
        canvasWidth={state.canvasLayout.width}
        canvasHeight={state.canvasLayout.height}
      />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
