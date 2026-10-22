import { font } from './fonts';

/**
 * Design system tokens for Hisaab
 * Apple-clean dark mode (iOS Settings & Apple Fitness style)
 */

export const colors = {
  // Surfaces & backgrounds
  bg: '#000000',
  card: '#1C1C1E',
  cardAlt: '#2C2C2E',
  border: '#38383A',

  // Stitch / Onboarding compatibility
  group: '#1C1C1E',
  control: '#2C2C2E',
  selected: '#636366',
  separator: '#38383A',

  // Text
  text: '#FFFFFF',
  textDim: '#8E8E93',
  textMute: '#48484A',
  secondary: '#8E8E93',
  tertiary: '#48484A',

  // Semantic color (meaning, not decoration)
  profit: '#10B981', // emerald green (in profit only)
  loss: '#FF453A',   // Apple red (in loss only)
  accent: '#F59E0B', // amber (warnings/notices only)

  // Macros
  protein: '#F87171',
  carbs: '#FBBF24',
  fat: '#60A5FA',
  water: '#38BDF8',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.75)',
  surfaceGlow: 'rgba(16, 185, 129, 0.12)',
  surfaceLossGlow: 'rgba(255, 69, 58, 0.12)',
  shimmer: '#2C2C2E',
};

export const radii = {
  card: 14, // iOS grouped-inset style
  pill: 999,
  button: 28, // 56 pt pill button
  input: 12,
  sm: 8,
  md: 12,
  lg: 14,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  largeTitle: {
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -0.8,
    color: colors.text,
  },
  balanceNumber: {
    fontFamily: font.bold,
    fontSize: 52,
    letterSpacing: -1,
    fontVariant: ['tabular-nums' as const],
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.text,
  },
  cardTitle: {
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.text,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 17,
    letterSpacing: -0.2,
    color: colors.textDim,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 14,
    letterSpacing: -0.1,
    color: colors.textMute,
  },
};
