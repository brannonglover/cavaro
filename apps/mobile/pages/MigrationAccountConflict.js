/**
 * Guest migration staged for a different account.
 *
 * Reached when a guest collection was staged for account A and account B then
 * signs in. The destination is NEVER changed implicitly — this screen is the
 * only path to redirecting it, and the original snapshot is preserved either
 * way (see lib/guestMigration.js confirmAccountChange).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import { colors, spacing, typography } from '../theme';

export default function MigrationAccountConflict() {
  const { accountConflict, confirmMigrationAccountChange, supabase, user } = useAuth();
  const [busy, setBusy] = useState(null);

  const count = accountConflict?.cigarCount ?? 0;

  const handleReturnToOriginal = () => {
    Alert.alert(
      'Sign out of this account?',
      'Your guest cigars stay saved on this device. Sign back in with the account you were adding them to and you can pick up where you left off.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          onPress: async () => {
            setBusy('signout');
            trackEvent('migration_account_change_declined');
            try {
              // Sign-out skips wipeLocalUserData while a migration is pending,
              // so the guest rows and the staged snapshot both survive.
              await supabase.auth.signOut();
            } catch (err) {
              Alert.alert('Could not sign out', err.message || 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  const handleMigrateHere = () => {
    Alert.alert(
      'Add these cigars to this account?',
      `${count === 1 ? 'This cigar' : `These ${count} cigars`} will be added to the account you are signed in to now, not the one they were originally staged for. You will review any overlaps next.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add them here',
          onPress: async () => {
            setBusy('confirm');
            const result = await confirmMigrationAccountChange();
            setBusy(null);
            if (!result.ok) {
              Alert.alert(
                'Could not continue',
                result.reason === 'no_session'
                  ? 'Your session expired. Please sign in again.'
                  : 'Your guest cigars are still safe on this device. Check your connection and try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconRing}>
            <MaterialCommunityIcons name="account-switch" size={30} color={colors.gold} />
          </View>

          <Text style={styles.title}>These cigars belong to another account</Text>
          <Text style={styles.subtitle}>
            {count === 1
              ? 'One cigar you added as a guest is'
              : `${count} cigars you added as a guest are`}{' '}
            waiting to be moved into a different Cavaro account than the one you
            are signed in to now.
            {'\n\n'}
            Nothing has been added, changed or deleted. Choose where they should go.
          </Text>

          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={handleReturnToOriginal}
            disabled={!!busy}
          >
            {busy === 'signout' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Return to the original account</Text>
            )}
          </Pressable>
          <Text style={styles.optionHint}>
            Signs you out so you can sign back in with that account. Your guest
            cigars stay on this device.
          </Text>

          <View style={styles.divider} />

          <Pressable
            style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            onPress={handleMigrateHere}
            disabled={!!busy}
          >
            {busy === 'confirm' ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={styles.secondaryBtnText}>
                Add them to {user?.email ? user.email : 'this account'} instead
              </Text>
            )}
          </Pressable>
          <Text style={styles.optionHint}>
            Moves the saved guest collection into the account you are signed in
            to now. You will review any overlapping cigars before anything is
            written.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  safeArea: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1, justifyContent: 'center' },
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
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', backgroundColor: colors.cardBg,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  btnDisabled: { opacity: 0.6 },
  optionHint: {
    fontSize: 12, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.sm, lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder,
    marginVertical: spacing.xl,
  },
});
