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
import { newId, nowIso } from '../lib/id';
import { cloneStrokes, toStrokeJson } from '../lib/strokes';
import {
  DEFAULT_STYLE,
  latestAsset,
  type Creation,
  type DoodleStroke,
  type GeneratedAsset,
  type GenerationJob,
  type StyleId,
} from '../models/types';
import { loadLibrary, upsertCreation } from '../storage/library';
import { getTransformClient } from '../transform';
import type { TransformResult } from '../transform/contracts';
import { usage } from '../usage/entitlement';

type Phase = 'canvas' | 'generating' | 'result';

interface AppState {
  ready: boolean;
  library: Creation[];
  creation: Creation;
  phase: Phase;
  brushColor: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
  undoStack: DoodleStroke[][];
  redoStack: DoodleStroke[][];
  activeAssetId?: string;
  generatingCopy: string;
  lastError?: string;
  dirty: boolean;
  /** Live canvas layout size (stroke coordinate space). */
  canvasLayout: { width: number; height: number };
}

type Action =
  | { type: 'hydrate'; library: Creation[] }
  | { type: 'set_tool'; tool: 'brush' | 'eraser' }
  | { type: 'set_color'; color: string }
  | { type: 'set_size'; size: number }
  | { type: 'add_stroke'; stroke: DoodleStroke }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'set_phase'; phase: Phase }
  | { type: 'set_style'; style: StyleId }
  | { type: 'set_generating'; copy: string; job: GenerationJob }
  | {
      type: 'transform_ok';
      asset: GeneratedAsset;
      job: GenerationJob;
      creation: Creation;
    }
  | { type: 'transform_err'; error: string; job: GenerationJob; creation: Creation }
  | { type: 'select_asset'; assetId: string }
  | { type: 'mark_saved'; creation: Creation; library: Creation[] }
  | { type: 'load_creation'; creation: Creation }
  | { type: 'new_doodle' }
  | { type: 'set_dirty'; dirty: boolean }
  | { type: 'replace_creation'; creation: Creation }
  | { type: 'set_canvas_layout'; width: number; height: number };

const BRUSH_COLORS = ['#1A1423', '#FF5C7A', '#5B8CFF', '#2EC4B6', '#F4A261', '#FFFFFF'];

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
    phase: 'canvas',
    brushColor: BRUSH_COLORS[0],
    brushSize: 8,
    tool: 'brush',
    undoStack: [],
    redoStack: [],
    generatingCopy: 'Understanding your doodle…',
    dirty: false,
    canvasLayout: { width: 1080, height: 1080 },
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
      const strokes = [...state.creation.strokes, action.stroke];
      return {
        ...state,
        creation: {
          ...state.creation,
          strokes,
          updatedAt: nowIso(),
        },
        undoStack: [...state.undoStack, state.creation.strokes],
        redoStack: [],
        dirty: true,
        lastError: undefined,
      };
    }
    case 'undo': {
      if (!state.undoStack.length) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.creation.strokes],
        creation: { ...state.creation, strokes: prev, updatedAt: nowIso() },
        dirty: true,
      };
    }
    case 'redo': {
      if (!state.redoStack.length) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.creation.strokes],
        creation: { ...state.creation, strokes: next, updatedAt: nowIso() },
        dirty: true,
      };
    }
    case 'clear':
      if (!state.creation.strokes.length) return state;
      return {
        ...state,
        undoStack: [...state.undoStack, state.creation.strokes],
        redoStack: [],
        creation: { ...state.creation, strokes: [], updatedAt: nowIso() },
        dirty: true,
      };
    case 'set_phase':
      return {
        ...state,
        phase: action.phase,
        lastError: action.phase === 'canvas' ? undefined : state.lastError,
      };
    case 'set_style':
      return {
        ...state,
        creation: { ...state.creation, style: action.style, updatedAt: nowIso() },
      };
    case 'set_generating':
      return {
        ...state,
        phase: 'generating',
        generatingCopy: action.copy,
        lastError: undefined,
        creation: {
          ...state.creation,
          jobs: [...state.creation.jobs, action.job],
          updatedAt: nowIso(),
        },
      };
    case 'transform_ok':
      return {
        ...state,
        phase: 'result',
        lastError: undefined,
        activeAssetId: action.asset.id,
        creation: action.creation,
        dirty: true,
      };
    case 'transform_err':
      return {
        ...state,
        phase: action.creation.assets.length ? 'result' : 'canvas',
        lastError: action.error,
        creation: action.creation,
      };
    case 'select_asset':
      return { ...state, activeAssetId: action.assetId, phase: 'result' };
    case 'mark_saved':
      return {
        ...state,
        creation: action.creation,
        library: action.library,
        dirty: false,
      };
    case 'load_creation':
      return {
        ...state,
        creation: action.creation,
        phase: action.creation.assets.length ? 'result' : 'canvas',
        activeAssetId: latestAsset(action.creation)?.id,
        undoStack: [],
        redoStack: [],
        dirty: false,
        lastError: undefined,
      };
    case 'new_doodle':
      return {
        ...state,
        creation: emptyCreation(),
        phase: 'canvas',
        undoStack: [],
        redoStack: [],
        activeAssetId: undefined,
        dirty: false,
        lastError: undefined,
      };
    case 'set_dirty':
      return { ...state, dirty: action.dirty };
    case 'replace_creation':
      return { ...state, creation: action.creation };
    case 'set_canvas_layout':
      return {
        ...state,
        canvasLayout: { width: action.width, height: action.height },
        creation: {
          ...state.creation,
          canvas: { width: action.width, height: action.height },
        },
      };
    default:
      return state;
  }
}

const COPIES = [
  'Understanding your doodle…',
  'Finding the magic…',
  'Making it beautiful…',
];

interface AppContextValue extends AppState {
  brushColors: string[];
  activeAsset?: GeneratedAsset;
  hasStrokes: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setTool: (tool: 'brush' | 'eraser') => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  addStroke: (stroke: DoodleStroke) => void;
  setCanvasLayout: (size: { width: number; height: number }) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  makeIt: () => Promise<void>;
  selectStyle: (style: StyleId) => Promise<void>;
  tryAnother: () => Promise<void>;
  editDoodle: () => void;
  saveCreation: () => Promise<void>;
  newDoodle: () => void;
  openCreation: (id: string) => void;
  dismissError: () => void;
  retryTransform: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const rasterRef = useRef<DoodleRasterHandle>(null);
  // Keep a ref to the latest creation so async transform always preserves strokes.
  const creationRef = useRef(state.creation);
  const layoutRef = useRef(state.canvasLayout);
  creationRef.current = state.creation;
  layoutRef.current = state.canvasLayout;

  useEffect(() => {
    track('app_open');
    void loadLibrary().then((library) => dispatch({ type: 'hydrate', library }));
  }, []);

  useEffect(() => {
    if (state.creation.strokes.length === 1 && state.undoStack.length === 0) {
      track('canvas_started');
    }
  }, [state.creation.strokes.length, state.undoStack.length]);

  const runTransform = useCallback(
    async (opts: { style: StyleId; reason: 'make' | 'style' | 'try' | 'retry' }) => {
      const creation = creationRef.current;
      const layout = layoutRef.current;
      const entitlement = usage.can('transform');
      if (!entitlement.allowed) {
        dispatch({
          type: 'transform_err',
          error: 'That one got a little weird.',
          job: {
            id: newId('job'),
            creationId: creation.id,
            style: opts.style,
            status: 'failed',
            startedAt: nowIso(),
            finishedAt: nowIso(),
            error: 'entitlement',
          },
          creation,
        });
        return;
      }

      const job: GenerationJob = {
        id: newId('job'),
        creationId: creation.id,
        style: opts.style,
        status: 'running',
        startedAt: nowIso(),
      };

      const copy = COPIES[Math.floor(Math.random() * COPIES.length)];
      dispatch({ type: 'set_generating', copy, job });
      dispatch({ type: 'set_style', style: opts.style });

      if (opts.reason === 'make') track('doodle_completed');
      if (opts.reason === 'style') track('style_selected', { style: opts.style });
      if (opts.reason === 'try') track('try_another', { style: opts.style });
      track('transform_started', { style: opts.style, reason: opts.reason });

      const strokesSnapshot = cloneStrokes(creation.strokes);
      const canvas = {
        width: layout.width || creation.canvas.width,
        height: layout.height || creation.canvas.height,
      };

      // Rasterize current doodle → PNG (primary identity). Strokes stay canonical.
      let doodleBase64: string | undefined;
      try {
        if (!rasterRef.current) {
          throw new Error('raster_surface_missing');
        }
        doodleBase64 = await rasterRef.current.capturePngBase64();
        if (!doodleBase64) {
          throw new Error('raster_capture_empty');
        }
      } catch (err) {
        track('transform_failed', {
          style: opts.style,
          error: err instanceof Error ? err.message : 'raster_failed',
        });
        const doneJob: GenerationJob = {
          ...job,
          status: 'failed',
          finishedAt: nowIso(),
          error: 'raster_failed',
        };
        dispatch({
          type: 'transform_err',
          error: 'That one got a little weird.',
          job: doneJob,
          creation: {
            ...creation,
            strokes: strokesSnapshot,
            jobs: [...creation.jobs.filter((j) => j.id !== job.id), doneJob],
            updatedAt: nowIso(),
          },
        });
        return;
      }

      const client = getTransformClient();
      const result: TransformResult = await client.transform({
        style: opts.style,
        doodle_base64: doodleBase64,
        strokes: toStrokeJson(strokesSnapshot, canvas),
        client_doodle_id: creation.id,
        options: { size: 1024 },
      });

      usage.record('transform');

      if (result.status === 'ok' && (result.image_url || result.image_base64)) {
        const imageUri = result.image_url
          ? result.image_url
          : `data:image/png;base64,${result.image_base64}`;
        const asset: GeneratedAsset = {
          id: newId('asset'),
          creationId: creation.id,
          style: opts.style,
          imageUri,
          transformVersion: result.transform_version,
          provider: result.provider ?? undefined,
          createdAt: nowIso(),
          metadata: result.metadata,
        };
        const doneJob: GenerationJob = {
          ...job,
          status: 'succeeded',
          finishedAt: nowIso(),
          assetId: asset.id,
        };
        const next: Creation = {
          ...creation,
          style: opts.style,
          strokes: strokesSnapshot,
          canvas,
          doodlePreviewUri: doodleBase64
            ? `data:image/png;base64,${doodleBase64}`
            : creation.doodlePreviewUri,
          assets: [...creation.assets, asset],
          jobs: [...creation.jobs.filter((j) => j.id !== job.id), doneJob],
          updatedAt: nowIso(),
        };
        track('transform_succeeded', { style: opts.style });
        dispatch({ type: 'transform_ok', asset, job: doneJob, creation: next });
      } else {
        const doneJob: GenerationJob = {
          ...job,
          status: 'failed',
          finishedAt: nowIso(),
          error: result.error || 'unknown',
        };
        // Preserve strokes + Creation on error — retry / edit remain available.
        const next: Creation = {
          ...creation,
          strokes: strokesSnapshot,
          canvas,
          doodlePreviewUri: doodleBase64
            ? `data:image/png;base64,${doodleBase64}`
            : creation.doodlePreviewUri,
          jobs: [...creation.jobs.filter((j) => j.id !== job.id), doneJob],
          updatedAt: nowIso(),
        };
        track('transform_failed', { style: opts.style, error: result.error });
        dispatch({
          type: 'transform_err',
          error: 'That one got a little weird.',
          job: doneJob,
          creation: next,
        });
      }
    },
    [],
  );

  const value = useMemo<AppContextValue>(() => {
    const activeAsset =
      state.creation.assets.find((a) => a.id === state.activeAssetId) ||
      latestAsset(state.creation);

    return {
      ...state,
      brushColors: BRUSH_COLORS,
      activeAsset,
      hasStrokes: state.creation.strokes.length > 0,
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
      setTool: (tool) => dispatch({ type: 'set_tool', tool }),
      setColor: (color) => dispatch({ type: 'set_color', color }),
      setSize: (size) => dispatch({ type: 'set_size', size }),
      addStroke: (stroke) => dispatch({ type: 'add_stroke', stroke }),
      setCanvasLayout: ({ width, height }) =>
        dispatch({ type: 'set_canvas_layout', width, height }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      clearCanvas: () => dispatch({ type: 'clear' }),
      makeIt: async () => {
        if (!state.creation.strokes.length) return;
        await runTransform({ style: state.creation.style || DEFAULT_STYLE, reason: 'make' });
      },
      selectStyle: async (style) => {
        await runTransform({ style, reason: 'style' });
      },
      tryAnother: async () => {
        await runTransform({ style: state.creation.style, reason: 'try' });
      },
      editDoodle: () => {
        track('edit_doodle');
        dispatch({ type: 'set_phase', phase: 'canvas' });
      },
      saveCreation: async () => {
        const saved: Creation = {
          ...state.creation,
          saved: true,
          updatedAt: nowIso(),
        };
        const library = await upsertCreation(saved);
        usage.record('save');
        track('saved', { id: saved.id });
        dispatch({ type: 'mark_saved', creation: saved, library });
      },
      newDoodle: () => {
        track('new_doodle');
        dispatch({ type: 'new_doodle' });
      },
      openCreation: (id) => {
        const found = state.library.find((c) => c.id === id);
        if (found) dispatch({ type: 'load_creation', creation: found });
      },
      dismissError: () =>
        dispatch({
          type: 'replace_creation',
          creation: { ...state.creation },
        }),
      retryTransform: async () => {
        await runTransform({ style: state.creation.style, reason: 'retry' });
      },
    };
  }, [state, runTransform]);

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
