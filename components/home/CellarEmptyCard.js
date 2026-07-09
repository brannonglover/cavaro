import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccentCard, CavaroButton } from '../ui';
import { borderRadius, colors, spacing, typography } from '../../theme';

export default function CellarEmptyCard({ onAction, style }) {
  return (
    <AccentCard
      variant="subtle"
      watermarkIcon="timer-sand"
      watermarkColor="rgba(143, 116, 64, 0.12)"
      style={style}
      bodyStyle={styles.body}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="barrel-outline" size={18} color={colors.goldMuted} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Nothing Cellaring Yet</Text>
          <Text style={styles.message}>
            Start cellaring from a cigar in your humidor inventory.
          </Text>
          {onAction ? (
            <CavaroButton
              variant="ghost"
              label="Go to Humidors →"
              onPress={onAction}
              style={styles.action}
            />
          ) : null}
        </View>
      </View>
    </AccentCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(143, 116, 64, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.sectionTitle,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  message: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: -spacing.sm,
  },
});
