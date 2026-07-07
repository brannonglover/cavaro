import { StyleSheet, Text, View } from 'react-native';
import { hapticLight } from '../../lib/haptics';
import { colors, spacing, typography } from '../../theme';
import PressableScale from './PressableScale';

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  style,
}) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <PressableScale
          onPress={() => {
            hapticLight();
            onActionPress();
          }}
          hitSlop={8}
          scaleTo={0.96}
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  textBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  action: {
    ...typography.caption,
    color: colors.goldBright,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
