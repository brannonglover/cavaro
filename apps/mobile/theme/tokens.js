/**
 * Cavaro design tokens — extended palette and utilities
 * Core tokens live in cavaroTheme.js (Task 001)
 * @see docs/CAVARO_DESIGN_TASKS.md
 */

import { colors as cavaroColors, spacing, radius } from './cavaroTheme';

export { spacing, radius } from './cavaroTheme';

export const colors = {
  ...cavaroColors,
  backgroundElevated: '#120F0B',
  surfaceWarm: '#2A1E14',
  goldBright: '#D7BA73',
  textSubtle: '#756B60',
  warning: '#C49A4A',
  black: '#050403',
  white: '#FFFFFF',
};

export const typography = {
  hero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metric: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
};

/** Legacy alias — prefer `radius` from cavaroTheme for new code */
export const borderRadius = {
  sm: 12,
  md: 16,
  card: 24,
  cardLarge: 28,
  tabBar: 24,
  pill: radius.pill,
};

/** React Native shadow objects — soft, warm depth on dark surfaces */
export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  cardSubtle: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  tabBar: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
};

const tokens = {
  colors,
  typography,
  spacing,
  radius,
  borderRadius,
  shadows,
};

export default tokens;
