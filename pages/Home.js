import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AtAGlanceStatsRow,
  CellarEmptyCard,
  HomeHeader,
  HumidorSnapshotCard,
  SmokeRecommendationCard,
  TasteSearchShortcutCard,
} from '../components/home';
import {
  CellaringProgressCard,
  EmptyState,
  FadeInView,
  ScreenContainer,
  SectionHeader,
} from '../components/ui';
import { trackEvent } from '../lib/analytics';
import { getHomeDashboard } from '../lib/homeDashboard';
import { syncCatalogCache } from '../lib/catalogSync';
import { INVENTORY_SEGMENTS } from '../lib/humidorsScreen';
import { useAuth } from '../context/AuthContext';
import MigrationConflictBanner from '../components/MigrationConflictBanner';
import GuestAccountBanner from '../components/GuestAccountBanner';
import { colors, spacing, typography } from '../theme';

export default function Home() {
  const navigation = useNavigation();
  const { requestSignup, isGuest, migration, refreshMigrationState } = useAuth();

  // Clearing `deferred` makes App.js show the blocking conflict screen again.
  const undeferMigrationAndReview = async () => {
    if (!migration?.migrationId) return;
    const { undeferMigration } = await import('../lib/guestMigration');
    await undeferMigration(migration.migrationId);
    await refreshMigrationState();
  };
  const [dashboard, setDashboard] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const next = await getHomeDashboard();
      if (!mountedRef.current) return;
      // Keep the previous object when nothing changed so a background catalog
      // refresh does not rerender the whole dashboard (and flash the cards).
      setDashboard((prev) =>
        prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    } catch (error) {
      console.log('Home dashboard error:', error);
      if (mountedRef.current) setDashboard({ isEmpty: true, greeting: 'Welcome' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Render from local data straight away...
      loadDashboard();
      // ...and refresh the catalog in the background. syncCatalogCache never
      // rejects and dedupes concurrent callers, so this costs nothing when
      // another screen already triggered it, and offline simply does nothing.
      syncCatalogCache().then((result) => {
        if (active && result.status === 'synced') loadDashboard();
      });
      return () => {
        active = false;
      };
    }, [loadDashboard])
  );

  const openHumidors = (inventorySegment) => {
    if (inventorySegment) {
      navigation.navigate('Humidors', {
        screen: 'CavaroList',
        params: { inventorySegment },
      });
      return;
    }
    navigation.navigate('Humidors', { screen: 'CavaroList' });
  };
  const addFirstCigar = () => navigation.navigate('Humidors', { screen: 'AddCigar' });
  const openTasteSearch = (source) => {
    trackEvent('taste_search_opened', { source });
    navigation.navigate('TasteSearch');
  };
  const openStat = (key) => {
    if (key === 'inventory') {
      openHumidors(INVENTORY_SEGMENTS.ALL);
      return;
    }
    if (key === 'cellared') {
      openHumidors(INVENTORY_SEGMENTS.CELLARED);
      return;
    }
    if (key === 'smoked') {
      navigation.navigate('Journal');
      return;
    }
    if (key === 'brands') {
      navigation.navigate('Collection');
    }
  };
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
        <HomeHeader greeting={dashboard.greeting} onAddCigar={addFirstCigar} onCreateAccount={requestSignup} />
        <EmptyState
          icon="smoking"
          title="Welcome to Cavaro"
          message="Start by adding your first cigar and building your personal cigar profile."
          actionLabel="Add First Cigar"
          onAction={addFirstCigar}
        />
        <TasteSearchShortcutCard
          onPress={() => openTasteSearch('home_empty')}
          style={styles.sectionCard}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <HomeHeader greeting={dashboard.greeting} onAddCigar={addFirstCigar} onCreateAccount={requestSignup} />
      </FadeInView>

      {isGuest && (
        <FadeInView delay={20}>
          <GuestAccountBanner onCreateAccount={requestSignup} />
        </FadeInView>
      )}

      {/* Only renders when a migration was deferred with conflicts outstanding. */}
      <FadeInView delay={20}>
        <MigrationConflictBanner onReview={undeferMigrationAndReview} />
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
        <AtAGlanceStatsRow
          inventoryCount={dashboard.inventoryCount}
          cellaredCount={dashboard.cellaredCount}
          smokedCount={dashboard.smokedCount}
          brandCount={dashboard.brandCount}
          onPressStat={openStat}
        />
      </FadeInView>

      {dashboard.humidors?.length > 0 ? (
        <FadeInView delay={120}>
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

      <FadeInView delay={180} style={styles.cellarSection}>
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

      <FadeInView delay={220}>
        <TasteSearchShortcutCard onPress={() => openTasteSearch('home')} />
      </FadeInView>
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
  cellarSection: {
    marginTop: spacing.md,
  },
  cellarCard: {
    marginBottom: spacing.md,
  },
  snapshotCard: {
    marginBottom: spacing.md,
  },
});
