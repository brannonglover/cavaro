import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TasteAccentCard from './TasteAccentCard';
import { borderRadius, colors, spacing, typography } from '../../theme';

const VARIANTS = {
  love: {
    accent: colors.success,
    watermark: 'heart-outline',
    watermarkColor: 'rgba(126, 159, 109, 0.14)',
    headerIcon: 'heart',
    headerIconColor: colors.success,
    headerIconBg: 'rgba(126, 159, 109, 0.16)',
    headerLabel: 'Flavors & profiles you gravitate toward',
    chipBg: 'rgba(126, 159, 109, 0.14)',
    chipBorder: 'rgba(126, 159, 109, 0.35)',
    chipText: colors.success,
    bulletColor: colors.success,
  },
  dislike: {
    accent: colors.danger,
    watermark: 'thumb-down-outline',
    watermarkColor: 'rgba(184, 92, 74, 0.12)',
    headerIcon: 'thumb-down-outline',
    headerIconColor: colors.danger,
    headerIconBg: 'rgba(184, 92, 74, 0.14)',
    headerLabel: 'Patterns you tend to avoid',
    chipBg: 'rgba(184, 92, 74, 0.12)',
    chipBorder: 'rgba(184, 92, 74, 0.32)',
    chipText: colors.danger,
    bulletColor: colors.danger,
  },
};

function PreferenceChip({ label, variant }) {
  const tokens = VARIANTS[variant] ?? VARIANTS.love;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: tokens.chipBg, borderColor: tokens.chipBorder },
      ]}
    >
      <Text style={[styles.chipText, { color: tokens.chipText }]}>{label}</Text>
    </View>
  );
}

export default function TastePreferenceCard({ variant = 'love', items, emptyLabel, style }) {
  const tokens = VARIANTS[variant] ?? VARIANTS.love;
  const hasItems = items?.length > 0;

  return (
    <TasteAccentCard
      variant="subtle"
      watermarkIcon={tokens.watermark}
      watermarkColor={tokens.watermarkColor}
      style={style}
      bodyStyle={styles.body}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: tokens.headerIconBg }]}>
          <MaterialCommunityIcons name={tokens.headerIcon} size={16} color={tokens.headerIconColor} />
        </View>
        <Text style={styles.headerLabel}>{tokens.headerLabel}</Text>
      </View>
      {hasItems ? (
        <View style={styles.chipRow}>
          {items.map((item) => (
            <PreferenceChip key={item} label={item} variant={variant} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyRow}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
    </TasteAccentCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
});
