import { DarkTheme } from '@react-navigation/native';
import { colors } from './tokens';

export const cavaroNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    card: colors.surfaceElevated,
    text: colors.text,
    border: colors.border,
    notification: colors.gold,
  },
};
