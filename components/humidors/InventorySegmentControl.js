import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CavaroText } from '../ui';
import { colors, radius, spacing } from '../../theme';

export default function InventorySegmentControl({
  options,
  value,
  onChange,
  style,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange?.(option.id)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <CavaroText
              variant="caption"
              tone={active ? 'gold' : 'muted'}
              style={active && styles.labelActive}
            >
              {option.label}
            </CavaroText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillActive: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.surfaceWarm,
  },
  labelActive: {
    fontWeight: '600',
  },
});
