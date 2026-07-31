import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../theme';
import CavaroBadge from './CavaroBadge';
import CavaroButton from './CavaroButton';
import PremiumCard from './PremiumCard';
import SegmentMeter from './SegmentMeter';

const DRINK_ICONS = {
  cocktail: 'glass-cocktail',
  whiskey: 'glass-mug-variant',
  bourbon: 'glass-mug-variant',
  rum: 'glass-cocktail',
  wine: 'glass-wine',
  beer: 'beer',
  coffee: 'coffee',
  tea: 'tea',
  spirit: 'bottle-wine',
  other: 'cup',
};

export function getDrinkIcon(drinkType) {
  return DRINK_ICONS[drinkType] || DRINK_ICONS.other;
}

export default function DrinkPairingCard({
  name,
  description,
  strengthMatch,
  flavorHarmony,
  experienceScore,
  drinkType = 'other',
  onViewDetails,
  style,
  showPremiumBadge = true,
}) {
  const iconName = getDrinkIcon(drinkType);

  return (
    <PremiumCard variant="elevated" style={[styles.card, style]}>
      {showPremiumBadge ? (
        <View style={styles.badgeRow}>
          <CavaroBadge label="PREMIUM" variant="gold" />
        </View>
      ) : null}

      <View style={styles.drinkRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={iconName} size={28} color={colors.gold} />
        </View>
        <View style={styles.drinkCopy}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={3}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Strength Match</Text>
          <SegmentMeter value={strengthMatch} />
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Flavor Harmony</Text>
          <SegmentMeter value={flavorHarmony} />
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.metricLabel}>Experience Score</Text>
          <Text style={styles.score}>{experienceScore}</Text>
        </View>
      </View>

      {onViewDetails ? (
        <CavaroButton
          variant="ghost"
          label="View Details →"
          onPress={onViewDetails}
          style={styles.action}
        />
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drinkCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  metrics: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 110,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  score: {
    ...typography.metric,
    color: colors.gold,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
