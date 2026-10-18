/**
 * Shown over the normal app after the user taps "Decide later" on the migration
 * conflict screen. Deferring does not clear cavaro_migration_pending, so guest
 * rows stay protected — this is the way back to finishing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

export default function MigrationConflictBanner({ onReview }) {
  const { migration } = useAuth();
  if (!migration?.deferred || !migration.unresolved) return null;

  const n = migration.unresolved;

  return (
    <Pressable style={styles.banner} onPress={onReview} accessibilityRole="button">
      <MaterialCommunityIcons name="merge" size={20} color={colors.gold} />
      <View style={styles.text}>
        <Text style={styles.title}>
          {n === 1 ? '1 cigar needs review' : `${n} cigars need review`}
        </Text>
        <Text style={styles.subtitle}>
          Your guest collection is saved on this device until you finish merging.
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.gold + '14',
    borderWidth: 1,
    borderColor: colors.gold + '55',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
