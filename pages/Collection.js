import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CigarCard,
  EmptyState,
  FadeInView,
  PremiumCard,
  ScreenContainer,
  SectionHeader,
  StatCard,
} from '../components/ui';
import { FavoriteBrandsCard } from '../components/collection';
import { getCollectionStats } from '../lib/collectionStats';
import { borderRadius, colors, spacing, typography } from '../theme';

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

const COLLECTION_STATS = [
  { key: 'smoked', label: 'Cigars Smoked', prop: 'totalSmoked', icon: 'cigar', accent: 'gold' },
  {
    key: 'unique',
    label: 'Unique Cigars',
    prop: 'uniqueCigars',
    icon: 'layers-triple-outline',
    accent: 'amber',
  },
  { key: 'brands', label: 'Brands', prop: 'brandsTried', icon: 'tag-multiple-outline', accent: 'sage' },
  { key: 'countries', label: 'Countries', prop: 'countriesTried', icon: 'earth', accent: 'tobacco' },
];

function WrapperBreakdownRow({ wrapper, count, total }) {
  const share = total > 0 ? count / total : 0;

  return (
    <View style={styles.wrapperRow}>
      <View style={styles.wrapperHeader}>
        <Text style={styles.wrapperName} numberOfLines={1}>
          {wrapper}
        </Text>
        <Text style={styles.wrapperCount}>{count}</Text>
      </View>
      <View style={styles.wrapperTrack}>
        <View style={[styles.wrapperFill, { width: `${Math.max(share * 100, 4)}%` }]} />
      </View>
    </View>
  );
}

export default function Collection() {
  const navigation = useNavigation();
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const next = await getCollectionStats();
      setStats(next);
    } catch (error) {
      console.log('Collection stats error:', error);
      setStats({ isEmpty: true, totalSmoked: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  if (!stats) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading collection...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (stats.isEmpty) {
    return (
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Collection</Text>
        <EmptyState
          icon="chart-timeline-variant"
          title="Your Collection Story Starts Here"
          message="As you smoke and rate cigars, Cavaro will build your lifetime collection profile."
          actionLabel="Go to Humidors"
          onAction={() => navigation.navigate('Humidors', { screen: 'CavaroList' })}
        />
      </ScreenContainer>
    );
  }

  const favoriteBrands = stats.favoriteBrands.filter((row) => row?.brand);
  const wrapperTotal = stats.wrapperBreakdown.reduce(
    (sum, row) => sum + (row.cnt ?? 0),
    0
  );

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <Text style={styles.title}>My Collection</Text>
        <Text style={styles.heroSubtitle}>Your lifetime cigar journey</Text>
      </FadeInView>

      <FadeInView delay={60}>
        <View style={styles.statsGrid}>
          {COLLECTION_STATS.map(({ key, label, prop, icon, accent }) => (
            <StatCard
              key={key}
              layout="collection"
              highlight={false}
              label={label}
              value={formatCount(stats[prop])}
              icon={icon}
              accent={accent}
              style={styles.statCard}
            />
          ))}
        </View>
      </FadeInView>

      {favoriteBrands.length > 0 ? (
        <FadeInView delay={120}>
          <SectionHeader title="Favorite Brands" subtitle="Most smoked brands" />
          <FavoriteBrandsCard brands={favoriteBrands} style={styles.sectionCard} />
        </FadeInView>
      ) : null}

      {stats.topRated.length > 0 ? (
        <>
          <SectionHeader title="Top Rated" subtitle="Highest journal ratings" />
          {stats.topRated.map((cigar) => (
            <CigarCard
              key={`top-${cigar.id}`}
              cigarId={cigar.id}
              name={cigar.name}
              brand={cigar.brand}
              line={cigar.line}
              vitola={cigar.length}
              wrapper={cigar.displayWrapper ?? cigar.wrapper}
              imageUrl={cigar.image}
              rating={cigar.best_rating}
            />
          ))}
        </>
      ) : null}

      {stats.mostSmoked.length > 0 ? (
        <>
          <SectionHeader title="Most Smoked" subtitle="Cigars you return to often" />
          {stats.mostSmoked.map((cigar) => (
            <CigarCard
              key={`smoked-${cigar.id}`}
              cigarId={cigar.id}
              name={cigar.name}
              brand={cigar.brand}
              line={cigar.line}
              vitola={cigar.length}
              wrapper={cigar.displayWrapper ?? cigar.wrapper}
              imageUrl={cigar.image}
              subtitle={`Smoked ${cigar.smoke_count} ${cigar.smoke_count === 1 ? 'time' : 'times'}`}
            />
          ))}
        </>
      ) : null}

      {stats.countries.length > 0 ? (
        <>
          <SectionHeader title="Countries Explored" subtitle="From filler origins in your journal" />
          <PremiumCard variant="subtle" style={styles.sectionCard}>
            <View style={styles.chipRow}>
              {stats.countries.slice(0, 12).map((country) => (
                <View key={country} style={styles.chip}>
                  <Text style={styles.chipText}>{country}</Text>
                </View>
              ))}
            </View>
          </PremiumCard>
        </>
      ) : null}

      {stats.wrapperBreakdown.length > 0 ? (
        <>
          <SectionHeader title="Wrapper Breakdown" />
          <PremiumCard variant="subtle" style={styles.sectionCard}>
            {stats.wrapperBreakdown.map((row) => (
              <WrapperBreakdownRow
                key={row.wrapper}
                wrapper={row.wrapper}
                count={row.cnt}
                total={wrapperTotal}
              />
            ))}
          </PremiumCard>
        </>
      ) : null}

      {stats.milestones.length > 0 ? (
        <>
          <SectionHeader title="Milestones" />
          {stats.milestones.map((milestone) => (
            <PremiumCard key={milestone.id} variant="warm" style={styles.milestoneCard}>
              <View style={styles.milestoneRow}>
                <MaterialCommunityIcons name="trophy-outline" size={22} color={colors.gold} />
                <Text style={styles.milestoneText}>{milestone.label}</Text>
              </View>
            </PremiumCard>
          ))}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    flexShrink: 1,
  },
  sectionCard: {
    marginBottom: spacing.xl,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  wrapperRow: {
    marginBottom: spacing.md,
  },
  wrapperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  wrapperName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.md,
  },
  wrapperCount: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '600',
  },
  wrapperTrack: {
    height: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
  },
  wrapperFill: {
    height: '100%',
    borderRadius: borderRadius.pill,
    backgroundColor: colors.goldMuted,
  },
  milestoneCard: {
    marginBottom: spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  milestoneText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
});
