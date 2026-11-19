import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { CavaroText } from '../ui';
import { colors, radius, spacing } from '../../theme';
import { HUMIDOR_FILTER_ALL } from '../../lib/humidorsScreen';

function HumidorPill({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <CavaroText
        variant="caption"
        tone={active ? 'gold' : 'muted'}
        style={active && styles.labelActive}
        numberOfLines={1}
      >
        {label}
      </CavaroText>
    </Pressable>
  );
}

export default function HumidorSelector({
  humidors = [],
  selectedHumidorId = HUMIDOR_FILTER_ALL,
  onChange,
  style,
}) {
  if (humidors.length <= 1) return null;

  const totalCount = humidors.reduce((sum, humidor) => sum + (humidor.cigar_count ?? 0), 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      <HumidorPill
        label={`All ${totalCount}`}
        active={selectedHumidorId == null}
        onPress={() => onChange?.(HUMIDOR_FILTER_ALL)}
      />
      {humidors.map((humidor) => {
        const count = humidor.cigar_count ?? 0;
        const label = `${humidor.name} ${count}`;
        return (
          <HumidorPill
            key={humidor.id}
            label={label}
            active={selectedHumidorId === humidor.id}
            onPress={() => onChange?.(humidor.id)}
          />
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
    maxWidth: 180,
  },
  pillActive: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.surfaceWarm,
  },
  labelActive: {
    fontWeight: '600',
  },
});
