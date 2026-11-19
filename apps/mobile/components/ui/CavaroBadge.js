import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const CAVARO_BADGE_VARIANTS = [
  'default',
  'gold',
  'success',
  'warning',
  'danger',
  'muted',
];

const VARIANTS = {
  default: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    textColor: colors.text,
  },
  gold: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.goldMuted,
    textColor: colors.goldBright,
  },
  success: {
    backgroundColor: 'rgba(126, 159, 109, 0.14)',
    borderColor: 'rgba(126, 159, 109, 0.4)',
    textColor: colors.success,
  },
  warning: {
    backgroundColor: 'rgba(196, 154, 74, 0.14)',
    borderColor: 'rgba(196, 154, 74, 0.4)',
    textColor: colors.warning,
  },
  danger: {
    backgroundColor: 'rgba(184, 92, 74, 0.14)',
    borderColor: 'rgba(184, 92, 74, 0.4)',
    textColor: colors.danger,
  },
  muted: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    textColor: colors.textMuted,
  },
};

export default function CavaroBadge({
  label,
  variant = 'default',
  style,
  textStyle,
}) {
  const palette = VARIANTS[variant] ?? VARIANTS.default;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.textColor }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
