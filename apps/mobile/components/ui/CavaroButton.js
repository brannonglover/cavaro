import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import PressableScale from './PressableScale';

export const CAVARO_BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'icon',
  'floating',
];

const VARIANTS = {
  primary: {
    container: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
    },
    label: {
      color: colors.black,
    },
    spinner: colors.black,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderColor: colors.goldMuted,
      borderWidth: 1,
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
    },
    label: {
      color: colors.gold,
    },
    spinner: colors.gold,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    label: {
      color: colors.gold,
    },
    spinner: colors.gold,
  },
  icon: {
    container: {
      backgroundColor: colors.surfaceLight,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      width: 44,
      height: 44,
      minHeight: 44,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: colors.gold,
    },
    iconColor: colors.gold,
    spinner: colors.gold,
  },
  floating: {
    container: {
      backgroundColor: colors.gold,
      borderWidth: 0,
      width: 56,
      height: 56,
      minHeight: 56,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.elevated,
    },
    label: {
      color: colors.black,
    },
    iconColor: colors.black,
    spinner: colors.black,
  },
};

function renderIcon(icon, size, color) {
  if (typeof icon === 'string') {
    return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  }

  return icon;
}

export default function CavaroButton({
  variant = 'primary',
  label,
  title,
  icon,
  iconSize = 22,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const text = label ?? title;
  const palette = VARIANTS[variant] ?? VARIANTS.primary;
  const isIconOnly = variant === 'icon' || variant === 'floating';
  const showIcon = Boolean(icon);
  const showLabel = Boolean(text) && !isIconOnly;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
      scaleTo={variant === 'floating' ? 0.94 : 0.98}
      style={[
        styles.base,
        palette.container,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.spinner} />
      ) : (
        <View style={[styles.content, showLabel && showIcon && styles.contentWithIcon]}>
          {showIcon ? renderIcon(icon, iconSize, palette.iconColor ?? palette.label.color) : null}
          {showLabel ? (
            <Text style={[styles.label, palette.label, textStyle]}>{text}</Text>
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWithIcon: {
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
