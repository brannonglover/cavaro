import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  MatchInsightCard,
  PalateSummaryCard,
  TasteAccentCard,
  TastePreferenceCard,
} from '../components/taste';
import {
  CigarCard,
  EmptyState,
  FadeInView,
  MatchBadge,
  ScreenContainer,
  SectionHeader,
} from '../components/ui';
import { trackEvent } from '../lib/analytics';
import { getMyTasteInsights } from '../lib/myTasteInsights';
import { borderRadius, colors, spacing, typography } from '../theme';

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

  const openTasteSearch = () => {
    trackEvent('taste_search_opened', { source: 'my_taste' });
    // TasteSearch lives in the Home tab's stack, so target it through that tab.
    navigation.navigate('Home', { screen: 'TasteSearch' });
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>My Taste</Text>
      <Pressable
        onPress={openTasteSearch}
        style={styles.headerAction}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Open Taste Search"
      >
        <MaterialCommunityIcons name="magnify" size={24} color={colors.gold} />
      </Pressable>
    </View>
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
        {header}
        <EmptyState
          icon="heart-outline"
          title="Cavaro Is Learning Your Palate"
          message="Log a few smoking experiences and your taste profile will begin to appear."
          actionLabel="Go to Humidors"
          onAction={() => navigation.navigate('Humidors', { screen: 'CavaroList' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        {header}
        <Text style={styles.subtitle}>
          Based on {insights.entryCount} journal {insights.entryCount === 1 ? 'entry' : 'entries'}
        </Text>
      </FadeInView>

      <FadeInView delay={60}>
        <SectionHeader title="Your Palate" subtitle="Taste summary" />
        <PalateSummaryCard profile={insights.profile} style={styles.sectionCard} />
      </FadeInView>

      <FadeInView delay={120}>
        <SectionHeader title="What You Love" />
        <TastePreferenceCard
          variant="love"
          items={insights.whatYouLove}
          emptyLabel="Rate more cigars to discover what you love."
          style={styles.sectionCard}
        />
      </FadeInView>

      <FadeInView delay={180}>
        <SectionHeader title="Usually Not Your Preference" />
        <TastePreferenceCard
          variant="dislike"
          items={insights.notYourPreference}
          emptyLabel="No clear dislikes yet — that is a good sign."
          style={styles.sectionCard}
        />
      </FadeInView>

      {insights.worthRevisiting.length > 0 ? (
        <FadeInView delay={240}>
          <SectionHeader title="Worth Revisiting" subtitle="Needs another chance" />
          {insights.worthRevisiting.map((item) => (
            <MatchInsightCard
              key={`revisit-${item.cigar.id}`}
              cigar={item.cigar}
              level={item.level}
              reason={item.reason}
              style={styles.insightCard}
            />
          ))}
        </FadeInView>
      ) : null}

      {insights.unlikelyMatches.length > 0 ? (
        <FadeInView delay={300}>
          <SectionHeader title="Unlikely Matches" subtitle="Probably not your profile" />
          {insights.unlikelyMatches.map((item) => (
            <MatchInsightCard
              key={`unlikely-${item.cigar.id}`}
              cigar={item.cigar}
              level={item.level}
              reason={item.reason}
              style={styles.insightCard}
            />
          ))}
        </FadeInView>
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
          <TasteAccentCard
            variant="subtle"
            watermarkIcon="cart-outline"
            style={styles.sectionCard}
            bodyStyle={styles.buyNextEmptyBody}
          >
            <View style={styles.buyNextEmptyRow}>
              <View style={styles.buyNextEmptyIcon}>
                <MaterialCommunityIcons name="shopping-outline" size={16} color={colors.gold} />
              </View>
              <Text style={styles.buyNextEmptyText}>
                Log more journal entries with ratings and flavors to unlock catalog recommendations.
              </Text>
            </View>
          </TasteAccentCard>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    minWidth: 44,
    alignItems: 'flex-end',
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
  insightCard: {
    marginBottom: spacing.md,
  },
  buyNextEmptyBody: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  buyNextEmptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  buyNextEmptyIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  buyNextEmptyText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
});
