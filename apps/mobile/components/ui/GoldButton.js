import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import CavaroButton from './CavaroButton';

const DESTRUCTIVE = {
  container: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.danger,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  label: {
    color: colors.danger,
  },
  spinner: colors.danger,
};

export default function GoldButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) {
  if (variant === 'destructive') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          DESTRUCTIVE.container,
          (disabled || loading) && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={DESTRUCTIVE.spinner} />
        ) : (
          <Text style={[styles.label, DESTRUCTIVE.label, textStyle]}>{title}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <CavaroButton
      variant={variant}
      title={title}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      textStyle={textStyle}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
  },
});
