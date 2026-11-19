/**
 * Guest→account migration conflict review.
 *
 * Shown blocking after sign-in when a migration staged conflicts, and reachable
 * from the banner after the user taps "Decide later". Nothing is written to the
 * collection and nothing is pushed until every row here is decided — see
 * docs/GUEST_MIGRATION_CONFLICTS.md.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import {
  TEXT_CONFLICT_FIELDS,
  combineText,
  groupConflictsByCigar,
} from '../lib/migrationConflicts';
import { colors, spacing, typography } from '../theme';

const FIELD_LABELS = {
  quantity: 'Quantity',
  collection: 'Collection',
  smoked_date: 'Last smoked',
  humidor_name: 'Humidor',
  smoke_notes: 'Smoking notes',
  favorite_notes: 'Favorite notes',
  flavor_profile: 'Flavor profile',
  strength_profile: 'Strength profile',
  construction_quality: 'Construction notes',
  flavor_changes: 'Flavor changes',
};

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

export default function MigrationConflicts({ onDone, onDefer }) {
  const { migration, refreshMigrationState, finishMigration } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualDrafts, setManualDrafts] = useState({});

  const migrationId = migration?.migrationId;

  const load = useCallback(async () => {
    if (!migrationId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const { getConflicts } = await import('../lib/guestMigration');
    const conflicts = await getConflicts(migrationId);
    setGroups(groupConflictsByCigar(conflicts));
    setLoading(false);
  }, [migrationId]);

  useEffect(() => { load(); }, [load]);

  const choose = async (conflict, resolution, resolvedValue = null) => {
    const { resolveConflict } = await import('../lib/guestMigration');
    await resolveConflict(
      migrationId,
      { brand: conflict.brand, name: conflict.name, length: conflict.length, field: conflict.field },
      resolution,
      resolvedValue
    );
    trackEvent('migration_conflict_resolved', { field: conflict.field, resolution });
    await load();
  };

  const remaining = groups.reduce(
    (n, g) => n + g.fields.filter((f) => !f.resolution).length,
    0
  );

  const handleFinish = async () => {
    setSaving(true);
    try {
      const result = await finishMigration();
      if (result.ok) {
        trackEvent('migration_conflicts_completed');
        onDone?.();
      } else {
        Alert.alert(
          'Could not finish',
          result.reason === 'unresolved_conflicts'
            ? 'Some cigars still need a decision.'
            : 'Your collection is safe on this device. Check your connection and try again.'
        );
        await refreshMigrationState();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDefer = async () => {
    const { deferMigration } = await import('../lib/guestMigration');
    await deferMigration(migrationId);
    trackEvent('migration_conflicts_deferred', { remaining });
    await refreshMigrationState();
    onDefer?.();
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconRing}>
            <MaterialCommunityIcons name="merge" size={30} color={colors.gold} />
          </View>

          <Text style={styles.title}>Review your collection</Text>
          <Text style={styles.subtitle}>
            {groups.length === 1
              ? 'One cigar is in both your guest collection and your account.'
              : `${groups.length} cigars are in both your guest collection and your account.`}
            {'\n'}Nothing has been changed or deleted — pick what to keep.
          </Text>

          {groups.map((group) => (
            <View key={`${group.brand}|${group.name}|${group.length}`} style={styles.card}>
              <Text style={styles.cardTitle}>
                {group.brand} {group.name}
              </Text>
              <Text style={styles.cardMeta}>{group.length}</Text>

              {group.fields.map((conflict) => {
                const key = `${conflict.brand}|${conflict.name}|${conflict.length}|${conflict.field}`;
                const isText = TEXT_CONFLICT_FIELDS.includes(conflict.field);
                const isQuantity = conflict.field === 'quantity';
                const resolved = !!conflict.resolution;

                return (
                  <View key={key} style={styles.field}>
                    <View style={styles.fieldHeader}>
                      <Text style={styles.fieldLabel}>
                        {FIELD_LABELS[conflict.field] ?? conflict.field}
                      </Text>
                      {resolved && (
                        <MaterialCommunityIcons name="check-circle" size={18} color={colors.gold} />
                      )}
                    </View>

                    <Pressable
                      style={[styles.option, conflict.resolution === 'guest' && styles.optionActive]}
                      onPress={() => choose(conflict, 'guest')}
                    >
                      <Text style={styles.optionTag}>From this device</Text>
                      <Text style={styles.optionValue}>{show(conflict.guest_value)}</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.option, conflict.resolution === 'server' && styles.optionActive]}
                      onPress={() => choose(conflict, 'server')}
                    >
                      <Text style={styles.optionTag}>From your account</Text>
                      <Text style={styles.optionValue}>{show(conflict.server_value)}</Text>
                    </Pressable>

                    {isText && (
                      <Pressable
                        style={[styles.option, conflict.resolution === 'both' && styles.optionActive]}
                        onPress={() => choose(conflict, 'both')}
                      >
                        <Text style={styles.optionTag}>Keep both</Text>
                        <Text style={styles.optionValue} numberOfLines={4}>
                          {combineText(conflict.guest_value, conflict.server_value)}
                        </Text>
                      </Pressable>
                    )}

                    {isQuantity && (
                      <View style={[styles.option, conflict.resolution === 'manual' && styles.optionActive]}>
                        <Text style={styles.optionTag}>Enter a combined total</Text>
                        <View style={styles.manualRow}>
                          <TextInput
                            style={styles.manualInput}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={colors.placeholderText}
                            value={
                              manualDrafts[key] ??
                              (conflict.resolution === 'manual' ? String(conflict.resolved_value ?? '') : '')
                            }
                            onChangeText={(t) =>
                              setManualDrafts((d) => ({ ...d, [key]: t.replace(/[^0-9]/g, '') }))
                            }
                          />
                          <Pressable
                            style={styles.manualSave}
                            onPress={() => {
                              const raw = manualDrafts[key];
                              const n = parseInt(raw, 10);
                              if (!Number.isFinite(n) || n < 0) {
                                Alert.alert('Enter a number', 'Please enter a quantity of 0 or more.');
                                return;
                              }
                              choose(conflict, 'manual', n);
                            }}
                          >
                            <Text style={styles.manualSaveText}>Use</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          <Pressable
            style={[styles.primaryBtn, (remaining > 0 || saving) && styles.primaryBtnDisabled]}
            onPress={handleFinish}
            disabled={remaining > 0 || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {remaining > 0 ? `${remaining} left to decide` : 'Finish merging'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={handleDefer} style={styles.deferBtn} hitSlop={12} disabled={saving}>
            <Text style={styles.deferText}>Decide later</Text>
          </Pressable>

          <Text style={styles.reassurance}>
            Your guest cigars stay on this device until you finish. Signing out or
            closing the app will not lose them.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  iconRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.gold + '1A',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: 21, marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  field: { marginTop: spacing.md },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  option: {
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  optionActive: { borderColor: colors.gold, backgroundColor: colors.gold + '14' },
  optionTag: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary },
  optionValue: { fontSize: 15, color: colors.textPrimary, marginTop: 4 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  manualInput: {
    flex: 1, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 16, color: colors.textPrimary,
  },
  manualSave: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
  },
  manualSaveText: { color: '#fff', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  deferBtn: { alignSelf: 'center', marginTop: spacing.lg, paddingVertical: 8 },
  deferText: { fontSize: 15, color: colors.textSecondary },
  reassurance: {
    fontSize: 12, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.lg, lineHeight: 17,
  },
});
