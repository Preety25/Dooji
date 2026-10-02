/** Domain models for Dooji mobile MVP — strokes are source of truth. */

export type StyleId = 'gummy' | 'clay' | 'plush' | 'glossy';

export interface StyleInfo {
  id: StyleId;
  label: string;
  blurb: string;
}

export const STYLES: StyleInfo[] = [
  { id: 'gummy', label: 'Gummy', blurb: 'juicy' },
  { id: 'clay', label: 'Clay', blurb: 'sculpted' },
  { id: 'plush', label: 'Plush', blurb: 'fuzzy' },
  { id: 'glossy', label: 'Glossy', blurb: 'polished' },
];

export const DEFAULT_STYLE: StyleId = 'gummy';

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DoodleStroke {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
  closed?: boolean;
}

export interface Doodle {
  canvas: { width: number; height: number };
  strokes: DoodleStroke[];
}

export type GenerationJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface GenerationJob {
  id: string;
  creationId: string;
  style: StyleId;
  status: GenerationJobStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  assetId?: string;
}

export interface GeneratedAsset {
  id: string;
  creationId: string;
  style: StyleId;
  /** Local file URI or data URI of the generated PNG. */
  imageUri: string;
  /** Transform pipeline version that produced this asset. */
  transformVersion?: string;
  /** Style pack version (product/styles/{id}.json). */
  styleVersion?: string;
  /** Semantic / prompt-compiler identity pin. */
  semanticVersion?: string;
  /** Fingerprint of the doodle strokes+canvas used to generate this asset. */
  doodleFingerprint?: string;
  provider?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Creation {
  id: string;
  strokes: DoodleStroke[];
  canvas: { width: number; height: number };
  /** Latest preview of the doodle raster (optional). */
  doodlePreviewUri?: string;
  style: StyleId;
  assets: GeneratedAsset[];
  jobs: GenerationJob[];
  saved: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export function latestAsset(creation: Creation): GeneratedAsset | undefined {
  if (!creation.assets.length) return undefined;
  return [...creation.assets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

/**
 * Latest asset for a style on this Creation (may be obsolete).
 * Prefer {@link lookupCachedAsset} from generation/cache for validity-aware reuse.
 */
export function assetForStyle(
  creation: Creation,
  style: StyleId,
): GeneratedAsset | undefined {
  const same = creation.assets.filter((a) => a.style === style);
  if (!same.length) return undefined;
  return [...same].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}
