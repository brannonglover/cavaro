import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AtAGlanceStatsRow,
  CellarEmptyCard,
  DrinkPairingShortcutCard,
  HomeHeader,
  HumidorSnapshotCard,
  SmokeRecommendationCard,
} from '../components/home';
import {
  CellaringProgressCard,
  EmptyState,
  FadeInView,
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
  const addFirstCigar = () => navigation.navigate('Humidors', { screen: 'AddCigar' });
  const openPairing = () => navigation.navigate('Pairing');
  const openRecommendationDetail = () => {
    const rec = dashboard?.smokeRecommendation;
    if (!rec?.cigar) return;
    navigation.navigate('CigarDetail', {
      cigar: rec.cigar,
      recommendation: {
        reason: rec.reason,
        level: rec.level,
        score: rec.score,
        reasons: rec.reasons,
      },
      imageUrl: rec.resolvedImage,
      displayWrapper: rec.displayWrapper,
    });
  };

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
        <HomeHeader greeting={dashboard.greeting} onAddCigar={addFirstCigar} />
        <EmptyState
          icon="smoking"
          title="Welcome to Cavaro"
          message="Start by adding your first cigar and building your personal cigar profile."
          actionLabel="Add First Cigar"
          onAction={addFirstCigar}
        />
        <DrinkPairingShortcutCard onPress={openPairing} style={styles.sectionCard} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <HomeHeader greeting={dashboard.greeting} onAddCigar={addFirstCigar} />
      </FadeInView>

      {dashboard.smokeRecommendation ? (
        <FadeInView delay={40}>
          <SmokeRecommendationCard
            name={dashboard.smokeRecommendation.cigar.name}
            brand={dashboard.smokeRecommendation.cigar.brand}
            wrapper={dashboard.smokeRecommendation.displayWrapper}
            reason={dashboard.smokeRecommendation.reason}
            imageUrl={dashboard.smokeRecommendation.resolvedImage}
            onViewDetails={openRecommendationDetail}
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={50}>
        <DrinkPairingShortcutCard onPress={openPairing} />
      </FadeInView>

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
          <CellarEmptyCard onAction={openHumidors} style={styles.sectionCard} />
        )}
      </FadeInView>

      {dashboard.humidors?.length > 0 ? (
        <FadeInView delay={180}>
          <SectionHeader title="Humidor Snapshot" />
          {dashboard.humidors.map((humidor) => (
            <HumidorSnapshotCard
              key={humidor.id}
              name={humidor.name}
              cigarCount={humidor.cigar_count}
              humidity={humidor.humidity}
              temperature={humidor.temperature}
              onPress={openHumidors}
              style={styles.snapshotCard}
            />
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
  cellarCard: {
    marginBottom: spacing.md,
  },
  snapshotCard: {
    marginBottom: spacing.md,
  },
});
