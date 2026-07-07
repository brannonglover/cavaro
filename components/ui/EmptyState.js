import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../theme';
import GoldButton from './GoldButton';

export default function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
  compact = false,
  style,
}) {
  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      {icon ? (
        <View style={[styles.iconRing, compact && styles.iconRingCompact]}>
          <MaterialCommunityIcons
            name={icon}
            size={compact ? 28 : 36}
            color={colors.gold}
          />
        </View>
      ) : null}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, compact && styles.messageCompact]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <GoldButton
          title={actionLabel}
          onPress={onAction}
          style={[styles.button, compact && styles.buttonCompact]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    minHeight: 260,
  },
  compact: {
    flex: 0,
    minHeight: 220,
    paddingVertical: spacing.xl,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(143, 116, 64, 0.45)',
    marginBottom: spacing.lg,
  },
  iconRingCompact: {
    width: 64,
    height: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 17,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  messageCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    maxWidth: 280,
  },
  buttonCompact: {
    marginTop: spacing.lg,
  },
});
