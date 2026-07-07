import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { HomeHeader, SmokeRecommendationCard, AtAGlanceStatsRow } from '../components/home';
import {
  CellaringProgressCard,
  EmptyState,
  FadeInView,
  PremiumCard,
  ScreenContainer,
  SectionHeader,
} from '../components/ui';
import { getHomeDashboard } from '../lib/homeDashboard';
import { colors, spacing, typography } from '../theme';

export default function Home() {
  const navigation = useNavigation();
  const [dashboard, setDashboard] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const next = await getHomeDashboard();
      setDashboard(next);
    } catch (error) {
      console.log('Home dashboard error:', error);
      setDashboard({ isEmpty: true, greeting: 'Welcome' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const openHumidors = () => navigation.navigate('Humidors');
  const openMyTaste = () => navigation.navigate('MyTaste');
  const addFirstCigar = () => navigation.navigate('Humidors', { screen: 'AddCigar' });

  if (!dashboard) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (dashboard.isEmpty) {
    return (
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <HomeHeader onAddCigar={addFirstCigar} />
        <EmptyState
          icon="smoking"
          title="Welcome to Cavaro"
          message="Start by adding your first cigar and building your personal cigar profile."
          actionLabel="Add First Cigar"
          onAction={addFirstCigar}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <HomeHeader onAddCigar={addFirstCigar} />
      </FadeInView>

      {dashboard.smokeRecommendation ? (
        <FadeInView delay={40}>
          <SmokeRecommendationCard
            name={dashboard.smokeRecommendation.cigar.name}
            brand={dashboard.smokeRecommendation.cigar.brand}
            wrapper={dashboard.smokeRecommendation.displayWrapper}
            reason={dashboard.smokeRecommendation.reason}
            imageUrl={dashboard.smokeRecommendation.resolvedImage}
            onViewDetails={openMyTaste}
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={60}>
        <AtAGlanceStatsRow
          inventoryCount={dashboard.inventoryCount}
          cellaredCount={dashboard.cellaredCount}
          smokedCount={dashboard.smokedCount}
          brandCount={dashboard.brandCount}
        />
      </FadeInView>

      <FadeInView delay={120}>
        <SectionHeader
          title="Ready From Cellar"
          subtitle="Cigars set aside to age"
          actionLabel={dashboard.cellaredCount > 0 ? 'Humidors' : undefined}
          onActionPress={dashboard.cellaredCount > 0 ? openHumidors : undefined}
        />

        {dashboard.readyFromCellar.length > 0 ? (
          dashboard.readyFromCellar.map((item) => (
            <CellaringProgressCard
              key={`cellar-${item.id}`}
              name={item.name}
              brand={item.brand}
              currentMonths={item.currentMonths}
              targetMonths={item.targetMonths}
              readyLabel={item.readyLabel}
              progress={item.progress}
              onPress={openHumidors}
              style={styles.cellarCard}
            />
          ))
        ) : (
          <PremiumCard variant="subtle" style={styles.sectionCard}>
            <EmptyState
              compact
              icon="timer-sand"
              title="Nothing Cellaring Yet"
              message="Start cellaring from a cigar in your humidor inventory."
              actionLabel="Go to Humidors"
              onAction={openHumidors}
              style={styles.sectionEmpty}
            />
          </PremiumCard>
        )}
      </FadeInView>

      {dashboard.humidors?.length > 0 ? (
        <FadeInView delay={180}>
          <SectionHeader title="Humidor Snapshot" />
          {dashboard.humidors.map((humidor) => (
            <PremiumCard key={humidor.id} variant="subtle" style={styles.snapshotCard} onPress={openHumidors}>
              <Text style={styles.snapshotName}>{humidor.name}</Text>
              <Text style={styles.snapshotMeta}>
                {humidor.cigar_count ?? 0} cigars
                {humidor.humidity != null ? `  ·  ${humidor.humidity}% RH` : ''}
                {humidor.temperature != null ? `  ·  ${humidor.temperature}°F` : ''}
              </Text>
            </PremiumCard>
          ))}
        </FadeInView>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.sm,
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
  sectionCard: {
    marginBottom: spacing.xl,
  },
  sectionEmpty: {
    minHeight: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  cellarCard: {
    marginBottom: spacing.md,
  },
  snapshotCard: {
    marginBottom: spacing.md,
  },
  snapshotName: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  snapshotMeta: {
    ...typography.body,
    color: colors.gold,
    marginTop: spacing.xs,
  },
});
