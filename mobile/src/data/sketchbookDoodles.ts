/**
 * Hand-drawn doodles for the empty-canvas sketchbook loop.
 * Drawn in a 200×200 box; `t` is stroke draw duration (seconds).
 * Paths adapted from the approved Magic Patterns sketchbook prototype.
 */
export interface SketchStroke {
  d: string;
  t: number;
}

export interface SketchAccent {
  kind: 'sparkle' | 'dash';
  x: number;
  y: number;
  /** Rotation degrees (dashes) or scale (sparkles). */
  r: number;
  tone: 'accent' | 'sunny';
}

export interface SketchDoodle {
  name: string;
  strokes: SketchStroke[];
  accents: SketchAccent[];
}

export const STROKE_GAP = 0.09;
export const HOLD = 1.2;
export const ERASE = 0.55;
export const NEXT_GAP = 0.18;
/** Per-doodle page tilt (degrees). */
export const TILTS = [-7, 5, -4, 8, -5] as const;
/** Pencil “boil” cycle — subtle texture shift cadence. */
export const BOIL_MS = 165;

export const sketchbookDoodles: SketchDoodle[] = [
  {
    name: 'Star',
    strokes: [
      {
        d: 'M100 40 C103 52 108 64 113 77 C127 77 143 78 157 81 C147 90 136 99 126 108 C129 123 134 139 137 154 C124 146 112 139 100 131 C88 139 76 147 63 155 C66 140 71 124 75 108 C64 99 53 90 43 80 C57 78 72 77 87 76 C92 63 96 52 101 41',
        t: 1.25,
      },
      { d: 'M89 99 C89 102 89.5 105 89 107', t: 0.16 },
      { d: 'M112 98 C112.5 101 112 104 112.4 106', t: 0.16 },
      { d: 'M88 116 C93 124 106 125 112 115', t: 0.32 },
    ],
    accents: [
      { kind: 'dash', x: 58, y: 44, r: 35, tone: 'accent' },
      { kind: 'dash', x: 74, y: 30, r: 62, tone: 'accent' },
      { kind: 'sparkle', x: 34, y: 112, r: 1, tone: 'sunny' },
      { kind: 'sparkle', x: 166, y: 132, r: 0.85, tone: 'accent' },
    ],
  },
  {
    name: 'Cat',
    strokes: [
      {
        d: 'M63 93 C59 77 60 63 65 50 C74 57 80 63 86 69 C95 66 106 65 115 68 C121 62 129 55 138 49 C142 62 143 77 138 93 C141 119 124 141 100 141 C76 142 59 121 63 94',
        t: 1.3,
      },
      { d: 'M85 96 C85 99 85.4 101 85 103', t: 0.14 },
      { d: 'M116 96 C116.4 98 116 101 116.3 103', t: 0.14 },
      {
        d: 'M96 110 C99 109 102 109 104 110 C103 112 101 114 100 114 C98 114 97 112 96 110',
        t: 0.22,
      },
      { d: 'M100 115 C98 121 92 122 88 118', t: 0.2 },
      { d: 'M100 115 C102 121 108 122 112 117', t: 0.2 },
      { d: 'M74 110 C66 108 58 107 50 107', t: 0.16 },
      { d: 'M74 118 C66 119 58 121 51 123', t: 0.16 },
      { d: 'M126 110 C134 108 142 106 150 106', t: 0.16 },
      { d: 'M126 118 C134 119 142 121 149 124', t: 0.16 },
    ],
    accents: [
      { kind: 'sparkle', x: 160, y: 50, r: 0.9, tone: 'sunny' },
      { kind: 'dash', x: 44, y: 60, r: 120, tone: 'accent' },
      { kind: 'sparkle', x: 40, y: 150, r: 0.75, tone: 'accent' },
    ],
  },
  {
    name: 'Heart',
    strokes: [
      {
        d: 'M100 82 C98 71 90 62 79 61 C63 59 48 73 50 93 C52 118 78 136 100 153 C121 137 148 119 150 93 C152 74 139 60 122 61 C111 62 103 71 100 83',
        t: 1.15,
      },
      { d: 'M68 88 C69 81 73 76 79 74', t: 0.22 },
    ],
    accents: [
      { kind: 'dash', x: 150, y: 50, r: 145, tone: 'accent' },
      { kind: 'dash', x: 164, y: 64, r: 115, tone: 'accent' },
      { kind: 'sparkle', x: 38, y: 58, r: 0.9, tone: 'sunny' },
      { kind: 'sparkle', x: 162, y: 148, r: 0.7, tone: 'sunny' },
    ],
  },
  {
    name: 'Flower',
    strokes: [
      {
        d: 'M101 86 C108 86 113 92 112 99 C111 106 104 110 98 109 C91 108 87 101 89 95 C91 90 95 86 102 87',
        t: 0.5,
      },
      { d: 'M93 88 C87 72 93 57 101 56 C109 56 113 71 107 87', t: 0.4 },
      { d: 'M112 93 C125 83 140 85 142 94 C143 103 128 108 113 104', t: 0.4 },
      { d: 'M109 109 C117 122 115 134 107 136 C98 137 96 124 101 110', t: 0.4 },
      { d: 'M94 108 C85 121 73 127 66 121 C60 114 72 106 89 103', t: 0.4 },
      { d: 'M88 94 C74 89 60 82 61 73 C63 64 79 69 93 87', t: 0.4 },
      { d: 'M102 137 C100 150 103 162 100 177', t: 0.32 },
      { d: 'M101 162 C109 151 121 150 127 154 C121 163 110 165 101 163', t: 0.34 },
    ],
    accents: [
      { kind: 'sparkle', x: 158, y: 60, r: 0.95, tone: 'accent' },
      { kind: 'sparkle', x: 42, y: 140, r: 0.8, tone: 'sunny' },
      { kind: 'dash', x: 50, y: 50, r: 45, tone: 'accent' },
    ],
  },
  {
    name: 'Car',
    strokes: [
      {
        d: 'M45 128 C44 117 50 110 62 108 L73 93 C79 85 88 82 98 82 L118 83 C128 83 134 87 140 96 L148 108 C160 110 165 117 164 128 C164 132 161 134 156 134 L52 134 C47 134 45 132 45 128',
        t: 1.25,
      },
      { d: 'M80 106 L88 93 C90 90 94 89 98 89 L102 89 L102 106 Z', t: 0.34 },
      { d: 'M110 106 L110 89 L118 89 C124 89 128 92 131 98 L135 106 Z', t: 0.34 },
      {
        d: 'M66 134 C66 126 72 122 78 122 C85 122 90 127 90 134 C90 141 84 146 78 146 C71 146 66 141 66.5 133',
        t: 0.36,
      },
      {
        d: 'M120 134 C120 126 126 122 132 122 C139 122 144 127 144 134 C144 141 138 146 132 146 C125 146 120 141 120.5 133',
        t: 0.36,
      },
      { d: 'M31 112 C26 112 22 112 17 113', t: 0.14 },
      { d: 'M33 122 C27 122 21 122 14 123', t: 0.14 },
    ],
    accents: [
      { kind: 'sparkle', x: 162, y: 70, r: 0.9, tone: 'sunny' },
      { kind: 'dash', x: 150, y: 56, r: 150, tone: 'accent' },
      { kind: 'sparkle', x: 60, y: 62, r: 0.7, tone: 'accent' },
    ],
  },
];

export const SUNNY = '#FFC53D';

/** Soft illustrative graphite — secondary to real user strokes. */
export const SKETCH_INK = {
  light: '#C5C2CC',
  dark: '#7A758A',
} as const;

/** Quiet accent marks (colored pencil, not CTA-weight). */
export const SKETCH_ACCENT = {
  light: '#B5A4E8',
  dark: '#9A8BC8',
} as const;

export const SKETCH_SUNNY = {
  light: '#E8C86A',
  dark: '#C4A84E',
} as const;

export function doodleDrawTime(doodle: SketchDoodle): number {
  return doodle.strokes.reduce((sum, s) => sum + s.t + STROKE_GAP, 0);
}
