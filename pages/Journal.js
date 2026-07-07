import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  EmptyState,
  FadeInView,
  PremiumCard,
  ScreenContainer,
  SectionHeader,
} from '../components/ui';
import { getJournalFeed } from '../lib/journalFeed';
import { colors, spacing, typography } from '../theme';

function formatEntryMeta(entry) {
  const parts = [];
  if (entry.rating != null) parts.push(String(entry.rating));
  if (entry.wouldBuyAgain) parts.push('Would Buy Again');
  return parts.join(' | ') || 'No rating yet';
}

function formatFlavorLine(entry) {
  const flavors = entry.likedFlavors?.slice(0, 6) ?? [];
  return flavors.length ? flavors.join(', ') : null;
}

function JournalEntryCard({ entry }) {
  const flavors = formatFlavorLine(entry);

  return (
    <PremiumCard variant="subtle" style={styles.entryCard}>
      <Text style={styles.entryTitle}>{entry.displayTitle}</Text>
      <Text style={styles.entryMeta}>{formatEntryMeta(entry)}</Text>
      {flavors ? <Text style={styles.entryFlavors}>{flavors}</Text> : null}
      {entry.notes ? (
        <Text style={styles.entryNotes} numberOfLines={2}>
          {entry.notes}
        </Text>
      ) : null}
    </PremiumCard>
  );
}

export default function Journal() {
  const navigation = useNavigation();
  const [entries, setEntries] = useState(null);

  const loadEntries = useCallback(async () => {
    try {
      const rows = await getJournalFeed();
      setEntries(rows);
    } catch (error) {
      console.log('Journal feed error:', error);
      setEntries([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const openHumidors = () => navigation.navigate('Humidors');

  if (entries === null) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading journal...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (entries.length === 0) {
    return (
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Journal</Text>
        <EmptyState
          icon="notebook-outline"
          title="No Journal Entries Yet"
          message="Mark a cigar as smoked to capture your first tasting note."
          actionLabel="Go to Humidors"
          onAction={openHumidors}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <FadeInView delay={0}>
        <Text style={styles.title}>Journal</Text>
        <SectionHeader title="Recently Smoked" subtitle="Your tasting notes" />
      </FadeInView>
      {entries.map((entry, index) => (
        <FadeInView key={entry.id} delay={80 + index * 40}>
          <JournalEntryCard entry={entry} />
        </FadeInView>
      ))}
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
    marginBottom: spacing.lg,
  },
  entryCard: {
    marginBottom: spacing.md,
  },
  entryTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  entryMeta: {
    ...typography.body,
    color: colors.gold,
    marginTop: spacing.xs,
  },
  entryFlavors: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  entryNotes: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.sm,
  },
});
