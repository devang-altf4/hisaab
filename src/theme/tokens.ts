/**
 * Design system tokens for Hisaab
 * Sleek dark mode (Cal AI inspired)
 */

export const colors = {
  bg: '#0A0A0C',
  card: '#16161A',
  cardAlt: '#1E1E24',
  border: '#26262E',

  text: '#F5F5F7',
  textDim: '#9A9AA5',
  textMute: '#5E5E68',

  profit: '#10B981', // emerald
  loss: '#EF4444',   // coral red
  accent: '#F59E0B', // amber

  protein: '#F87171',
  carbs: '#FBBF24',
  fat: '#60A5FA',
  water: '#38BDF8',

  // Status/overlays
  overlay: 'rgba(0, 0, 0, 0.75)',
  surfaceGlow: 'rgba(16, 185, 129, 0.12)',
  surfaceLossGlow: 'rgba(239, 68, 68, 0.12)',
  shimmer: '#2A2A35',
};

export const radii = {
  card: 20,
  pill: 999,
  button: 16,
  input: 14,
  sm: 8,
  md: 12,
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
  balanceNumber: {
    fontSize: 52,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums' as const],
    color: colors.text,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textDim,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textMute,
  },
};

