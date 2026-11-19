import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccentCard } from '../ui';
import { borderRadius, colors, spacing, typography } from '../../theme';

function StatPill({ icon, label, tone = 'default' }) {
  const isGold = tone === 'gold';

  return (
    <View style={[styles.pill, isGold && styles.pillGold]}>
      <MaterialCommunityIcons
        name={icon}
        size={12}
        color={isGold ? colors.gold : colors.textMuted}
      />
      <Text style={[styles.pillText, isGold && styles.pillTextGold]}>{label}</Text>
    </View>
  );
}

export default function HumidorSnapshotCard({ name, cigarCount, humidity, temperature, onPress, style }) {
  const stats = [
    {
      key: 'count',
      icon: 'cigar',
      label: `${cigarCount ?? 0} cigars`,
      tone: 'gold',
    },
    humidity != null
      ? { key: 'rh', icon: 'water-percent', label: `${humidity}% RH`, tone: 'default' }
      : null,
    temperature != null
      ? { key: 'temp', icon: 'thermometer', label: `${temperature}°F`, tone: 'default' }
      : null,
  ].filter(Boolean);

  return (
    <AccentCard
      variant="elevated"
      watermarkIcon="fridge-outline"
      watermarkColor="rgba(200, 164, 93, 0.1)"
      onPress={onPress}
      style={style}
      bodyStyle={styles.body}
      padding={0}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="fridge-outline" size={18} color={colors.gold} />
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.pillRow}>
            {stats.map((stat) => (
              <StatPill key={stat.key} icon={stat.icon} label={stat.label} tone={stat.tone} />
            ))}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.sectionTitle,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillGold: {
    backgroundColor: 'rgba(200, 164, 93, 0.14)',
  },
  pillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pillTextGold: {
    color: colors.gold,
  },
});
