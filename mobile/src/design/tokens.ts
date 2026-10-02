/**
 * Design tokens — Figtree (UI) + Newsreader (display) per final Magic Patterns /
 * approved MVP comps. Exact values tuned to attached screen designs.
 */

export type ThemeMode = 'light' | 'dark';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  toolbar: 56,
  touch: 48,
  makeIt: 52,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  tile: 16,
  card: 24,
  pill: 999,
} as const;

export const PALETTE = [
  '#1B1A17',
  '#8338EC',
  '#F97316',
  '#22D3EE',
  '#F43F5E',
  '#84CC16',
  '#FBBF24',
  '#FFFFFF',
] as const;

export const brushSizes = [5, 9, 15] as const;

export type ThemeColors = {
  surface: string;
  surfaceElevated: string;
  canvas: string;
  ink: string;
  muted: string;
  hint: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentSoft: string;
  accentPressed: string;
  /** Canvas Make it — enabled fill (theme-specific; not shared purple in dark). */
  makeItActive: string;
  makeItActiveText: string;
  makeItActiveIcon: string;
  makeItMuted: string;
  makeItMutedText: string;
  toolbarBg: string;
  toolbarBorder: string;
  /** Vertical separators inside the canvas toolbar — subtle, not ink-black. */
  toolbarDivider: string;
  /** Selected pen/eraser circle fill. */
  controlSelectedBg: string;
  /** Glyph/dot on selected control — must contrast against controlSelectedBg. */
  controlSelectedFg: string;
  styleTile: string;
  styleTileBorder: string;
  surpriseBorder: string;
  libraryBtn: string;
  libraryIcon: string;
  overlay: string;
  dangerSoft: string;
  limeCta: string;
  limeCtaText: string;
  checkmark: string;
  /** Generated-but-not-current style check badge fill. */
  checkmarkIdleBg: string;
  checkmarkIdleIcon: string;
  danger: string;
  /** High-emphasis sheet CTA (Save and leave) — white on dark / ink on light. */
  sheetPrimaryBg: string;
  sheetPrimaryText: string;
  /** Secondary sheet CTA (Discard and leave). */
  sheetSecondaryBg: string;
  sheetSecondaryText: string;
  sheetSecondaryBorder: string;
  /** Soft secondary / Save button on Result. */
  btnSecondaryBg: string;
  btnSecondaryText: string;
  btnSecondaryBorder: string;
  toastBg: string;
  toastText: string;
};

export const lightColors: ThemeColors = {
  surface: '#F7F6FB',
  surfaceElevated: '#FFFFFF',
  canvas: '#FFFFFF',
  ink: '#1B1A17',
  muted: '#6E6B75',
  hint: '#B5B3BC',
  border: 'rgba(27, 26, 23, 0.1)',
  borderSubtle: 'rgba(27, 26, 23, 0.12)',
  accent: '#8B6CF0',
  accentSoft: '#ECE8FF',
  accentPressed: '#7A5CE0',
  makeItActive: '#8B6CF0',
  makeItActiveText: '#FFFFFF',
  makeItActiveIcon: '#FFD34D',
  makeItMuted: '#EEEDEB',
  makeItMutedText: '#6E6B75',
  toolbarBg: '#FFFFFF',
  toolbarBorder: 'rgba(27, 26, 23, 0.1)',
  toolbarDivider: '#D8D6DE',
  controlSelectedBg: '#1B1A17',
  controlSelectedFg: '#FFFFFF',
  styleTile: '#ECE8FF',
  styleTileBorder: 'transparent',
  surpriseBorder: '#8B6CF0',
  libraryBtn: '#ECE8FF',
  libraryIcon: '#8B6CF0',
  overlay: 'rgba(27, 26, 23, 0.4)',
  dangerSoft: '#FFF0F2',
  limeCta: '#C8F27A',
  limeCtaText: '#1B1A17',
  checkmark: '#8B6CF0',
  checkmarkIdleBg: '#FFFFFF',
  checkmarkIdleIcon: '#8B6CF0',
  danger: '#CE3444',
  sheetPrimaryBg: '#1B1A17',
  sheetPrimaryText: '#FFFFFF',
  sheetSecondaryBg: '#FFFFFF',
  sheetSecondaryText: '#1B1A17',
  sheetSecondaryBorder: 'rgba(27, 26, 23, 0.12)',
  btnSecondaryBg: '#FFFFFF',
  btnSecondaryText: '#1B1A17',
  btnSecondaryBorder: 'rgba(27, 26, 23, 0.12)',
  toastBg: '#ECE8FF',
  toastText: '#1B1A17',
};

/** Dark palette from approved Canvas / dialog comps — not a mechanical invert. */
export const darkColors: ThemeColors = {
  surface: '#252230',
  surfaceElevated: '#3E3A4C',
  canvas: '#3E3A4C',
  ink: '#F6F4FA',
  muted: '#B8B3C6',
  hint: '#8A859A',
  border: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.14)',
  accent: '#A48CFA',
  accentSoft: '#4A4560',
  accentPressed: '#8B6FE0',
  // Dark active Make it matches final design: purple fill + white label + yellow spark.
  makeItActive: '#8E6BEE',
  makeItActiveText: '#FFFFFF',
  makeItActiveIcon: '#FFD34D',
  makeItMuted: '#2A2833',
  makeItMutedText: '#FFFFFF',
  toolbarBg: '#3E3A4C',
  toolbarBorder: 'rgba(255, 255, 255, 0.1)',
  toolbarDivider: 'rgba(255, 255, 255, 0.16)',
  // Light selected circle + dark glyph so the pencil stays readable.
  controlSelectedBg: '#F6F4FA',
  controlSelectedFg: '#1B1A17',
  styleTile: '#484358',
  styleTileBorder: 'transparent',
  surpriseBorder: '#A48CFA',
  libraryBtn: '#484358',
  libraryIcon: '#C4B5FD',
  overlay: 'rgba(0, 0, 0, 0.55)',
  dangerSoft: '#3A2430',
  limeCta: '#C8F27A',
  limeCtaText: '#1B1A17',
  checkmark: '#A48CFA',
  checkmarkIdleBg: '#484358',
  checkmarkIdleIcon: '#A48CFA',
  danger: '#FF6E7C',
  // Dialog: white primary / deep secondary (final dark Keep-this-doodle sheet).
  sheetPrimaryBg: '#FFFFFF',
  sheetPrimaryText: '#1B1A17',
  sheetSecondaryBg: '#1B1A17',
  sheetSecondaryText: '#FFFFFF',
  sheetSecondaryBorder: 'transparent',
  btnSecondaryBg: '#3E3A4C',
  btnSecondaryText: '#F6F4FA',
  btnSecondaryBorder: 'rgba(255, 255, 255, 0.14)',
  toastBg: '#4A4560',
  toastText: '#F6F4FA',
};

/**
 * Soft dimensional shadow tinted with the swatch's own hue (not universal black).
 * Used on the active brush swatch only.
 */
export function brushSwatchShadow(hex: string): {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
} {
  const normalized = hex.trim().toLowerCase();
  const isWhite = normalized === '#ffffff' || normalized === '#fff';
  return {
    shadowColor: isWhite ? '#B5B3BC' : hex,
    shadowOpacity: isWhite ? 0.35 : 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  };
}

/** @deprecated Prefer useTheme().colors */
export const colors = {
  brand: lightColors.ink,
  ink: lightColors.ink,
  muted: lightColors.muted,
  hint: lightColors.hint,
  surface: lightColors.surface,
  surfaceElevated: lightColors.surfaceElevated,
  canvas: lightColors.canvas,
  accent: lightColors.accent,
  accentSoft: lightColors.accentSoft,
  accentPressed: lightColors.accentPressed,
  border: lightColors.border,
  overlay: lightColors.overlay,
  dangerSoft: lightColors.dangerSoft,
  styleChip: lightColors.styleTile,
  styleChipActive: lightColors.ink,
} as const;

/** Figtree = UI sans; Newsreader = display/editorial (final comps). */
export const type = {
  brand: {
    fontFamily: 'Figtree_800ExtraBold',
    fontSize: 25,
    letterSpacing: -0.04 * 25,
  },
  editorial: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 28,
    letterSpacing: -0.02 * 28,
  },
  editorialEm: {
    fontFamily: 'Newsreader_500Medium_Italic',
    fontSize: 28,
    letterSpacing: -0.02 * 28,
  },
  title: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 22,
    letterSpacing: -0.02 * 22,
  },
  body: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 16,
  },
  caption: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 13,
  },
  button: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 16,
    letterSpacing: -0.01 * 16,
  },
  styleLabel: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 16,
  },
} as const;

export const motion = {
  press: { damping: 38, stiffness: 560, mass: 0.7 },
  spring: { damping: 30, stiffness: 300, mass: 0.9 },
  soft: { damping: 30, stiffness: 260, mass: 0.9 },
} as const;

export const logoRed = '#FB4A52';
