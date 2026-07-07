import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  CigarCard,
  EmptyState,
  FadeInView,
  MatchBadge,
  PremiumCard,
  ScreenContainer,
  SectionHeader,
} from '../components/ui';
import { getMyTasteInsights } from '../lib/myTasteInsights';
import { colors, spacing, typography } from '../theme';

function BulletList({ items, emptyLabel }) {
  if (!items?.length) {
    return <Text style={styles.emptySectionText}>{emptyLabel}</Text>;
  }

  return items.map((item) => (
    <View key={item} style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function InsightCard({ cigar, level, reason, score }) {
  return (
    <PremiumCard variant="subtle" style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightName} numberOfLines={1}>
          {cigar.name || 'Unknown'}
        </Text>
        <MatchBadge level={level} />
      </View>
      <Text style={styles.insightMeta} numberOfLines={1}>
        {[cigar.brand, cigar.line].filter(Boolean).join(' · ') || '—'}
      </Text>
      <Text style={styles.insightReason}>{reason}</Text>
      {typeof score === 'number' ? (
        <Text style={styles.insightScore}>Match score {score}</Text>
      ) : null}
    </PremiumCard>
  );
}

export default function MyTaste() {
  const navigation = useNavigation();
  const [insights, setInsights] = useState(null);

  const loadInsights = useCallback(async () => {
    try {
      const next = await getMyTasteInsights();
      setInsights(next);
    } catch (error) {
      console.log('My Taste insights error:', error);
      setInsights({ isEmpty: true, entryCount: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [loadInsights])
  );

  if (!insights) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Analyzing your palate...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (insights.isEmpty) {
    return (
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Taste</Text>
        <EmptyState
          icon="heart-outline"
          title="Cavaro Is Learning Your Palate"
          message="Log a few smoking experiences and your taste profile will begin to appear."
          actionLabel="Go to Humidors"
          onAction={() => navigation.navigate('Humidors')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <Text style={styles.title}>My Taste</Text>
        <Text style={styles.subtitle}>
          Based on {insights.entryCount} journal {insights.entryCount === 1 ? 'entry' : 'entries'}
        </Text>
      </FadeInView>

      <FadeInView delay={60}>
        <SectionHeader title="Your Palate" subtitle="Taste summary" />
        <PremiumCard variant="warm" style={styles.sectionCard}>
          <Text style={styles.palateText}>
            {insights.tasteSummary || 'Keep logging ratings and flavors to refine your palate.'}
          </Text>
        </PremiumCard>
      </FadeInView>

      <SectionHeader title="What You Love" />
      <PremiumCard variant="subtle" style={styles.sectionCard}>
        <BulletList
          items={insights.whatYouLove}
          emptyLabel="Rate more cigars to discover what you love."
        />
      </PremiumCard>

      <SectionHeader title="Usually Not Your Preference" />
      <PremiumCard variant="subtle" style={styles.sectionCard}>
        <BulletList
          items={insights.notYourPreference}
          emptyLabel="No clear dislikes yet — that is a good sign."
        />
      </PremiumCard>

      {insights.worthRevisiting.length > 0 ? (
        <>
          <SectionHeader title="Worth Revisiting" subtitle="Needs another chance" />
          {insights.worthRevisiting.map((item) => (
            <InsightCard
              key={`revisit-${item.cigar.id}`}
              cigar={item.cigar}
              level={item.level}
              reason={item.reason}
            />
          ))}
        </>
      ) : null}

      {insights.unlikelyMatches.length > 0 ? (
        <>
          <SectionHeader title="Unlikely Matches" subtitle="Probably not your profile" />
          {insights.unlikelyMatches.map((item) => (
            <InsightCard
              key={`unlikely-${item.cigar.id}`}
              cigar={item.cigar}
              level={item.level}
              reason={item.reason}
            />
          ))}
        </>
      ) : null}

      {insights.buyNext.length > 0 ? (
        <>
          <SectionHeader title="Buy Next" subtitle="Strong matches from catalog" />
          {insights.buyNext.map((item) => (
            <CigarCard
              key={`buy-${item.cigar.id}-${item.cigar.brand}-${item.cigar.name}`}
              name={item.cigar.name}
              brand={item.cigar.brand}
              line={item.cigar.line}
              vitola={item.cigar.length}
              imageUrl={item.cigar.image}
              subtitle={[item.reasons?.slice(0, 2).join(' · '), `Score ${item.score}`]
                .filter(Boolean)
                .join(' · ')}
              footer={<MatchBadge level={item.level} />}
            />
          ))}
        </>
      ) : (
        <>
          <SectionHeader title="Buy Next" />
          <PremiumCard variant="subtle" style={styles.sectionCard}>
            <Text style={styles.emptySectionText}>
              Log more journal entries with ratings and flavors to unlock catalog recommendations.
            </Text>
          </PremiumCard>
        </>
      )}
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
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  sectionCard: {
    marginBottom: spacing.xl,
  },
  palateText: {
    ...typography.sectionTitle,
    color: colors.gold,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletDot: {
    ...typography.body,
    color: colors.gold,
    width: 16,
  },
  bulletText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  emptySectionText: {
    ...typography.body,
    color: colors.textMuted,
  },
  insightCard: {
    marginBottom: spacing.md,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  insightName: {
    ...typography.sectionTitle,
    color: colors.text,
    flex: 1,
  },
  insightMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  insightReason: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
  insightScore: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
});
