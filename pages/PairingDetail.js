import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  CavaroBadge,
  PremiumCard,
  ScreenContainer,
  SegmentMeter,
  getDrinkIcon,
} from '../components/ui';
import { borderRadius, colors, spacing, typography } from '../theme';

export default function PairingDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { pairing, cigar } = route.params ?? {};

  if (!pairing) {
    return (
      <ScreenContainer>
        <View style={styles.fallback}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.fallbackText}>Pairing not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const iconName = getDrinkIcon(pairing.drinkType);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Pairing Details</Text>
        <View style={styles.backBtn} />
      </View>

      <PremiumCard variant="elevated" style={styles.heroCard}>
        <View style={styles.badgeRow}>
          <CavaroBadge label="PREMIUM" variant="gold" />
        </View>

        <View style={styles.drinkRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={iconName} size={32} color={colors.gold} />
          </View>
          <View style={styles.drinkCopy}>
            <Text style={styles.name}>{pairing.name}</Text>
            {cigar ? (
              <Text style={styles.cigarContext}>Pairs with {cigar}</Text>
            ) : null}
          </View>
        </View>

        {pairing.description ? (
          <Text style={styles.description}>{pairing.description}</Text>
        ) : null}

        <View style={styles.metrics}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Strength Match</Text>
            <SegmentMeter value={pairing.strengthMatch} />
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Flavor Harmony</Text>
            <SegmentMeter value={pairing.flavorHarmony} />
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.metricLabel}>Experience Score</Text>
            <Text style={styles.score}>{pairing.experienceScore}</Text>
          </View>
        </View>
      </PremiumCard>

      {pairing.details ? (
        <PremiumCard variant="subtle" style={styles.detailsCard}>
          <Text style={styles.sectionLabel}>Why this works</Text>
          <Text style={styles.detailsText}>{pairing.details}</Text>
        </PremiumCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backBtn: {
    minWidth: 72,
  },
  backText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '500',
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  fallbackText: {
    ...typography.body,
    color: colors.textMuted,
  },
  heroCard: {
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
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
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
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
  },
  cigarContext: {
    ...typography.caption,
    color: colors.goldBright,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  metrics: {
    gap: spacing.md,
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
  detailsCard: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.goldMuted,
    marginBottom: spacing.sm,
  },
  detailsText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
});
