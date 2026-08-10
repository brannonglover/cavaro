import { StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

export const TAB_BAR_CONTENT_HEIGHT = 60;

export const cavaroTabBarStyle = StyleSheet.create({
  bar: {
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(143, 116, 64, 0.28)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    paddingTop: spacing.sm,
    elevation: 0,
    ...shadows.tabBar,
  },
});
