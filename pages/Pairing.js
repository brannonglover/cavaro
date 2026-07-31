import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeedbackBtn from '../components/FeedbackBtn';
import SubscriptionLegalLinks from '../components/SubscriptionLegalLinks';
import RestoreSubscriptionResultModal, {
  getRestoreSubscriptionAlert,
  getSubscribeFailureAlert,
} from '../components/RestoreSubscriptionResultModal';
import {
  CavaroButton,
  DrinkPairingCard,
  PremiumCard,
  ScreenContainer,
} from '../components/ui';
import { getDrinkPairing } from '../api/pairing';
import { subscribeOrManage, getSubscriptionStatus, restoreSubscription } from '../api/subscription';
import { API_BASE_URL } from '../api/config';
import { openManageSubscriptions } from '../lib/iap';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import { borderRadius, colors, spacing, typography } from '../theme';

function Pairing() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tier, supabase, refreshTier } = useAuth();
  const initialCigar = route.params?.cigar?.trim?.() || '';

  const [cigar, setCigar] = useState(initialCigar);
  const [pairings, setPairings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreAlert, setRestoreAlert] = useState(null);

  useEffect(() => {
    if (initialCigar) {
      setCigar(initialCigar);
    }
  }, [initialCigar]);

  useFocusEffect(
    React.useCallback(() => {
      refreshTier?.();
    }, [refreshTier])
  );

  const handleSubscribe = async () => {
    if (!supabase) {
      Alert.alert('Not configured', 'Supabase auth is not set up.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      Alert.alert('Sign in required', 'Please sign in to subscribe.');
      return;
    }
    setCheckoutLoading(true);
    try {
      const result = await subscribeOrManage(session.access_token, tier, session.user?.id);
      if (result?.alreadySubscribed) {
        Alert.alert(
          "You're already subscribed",
          'Would you like to manage your subscription?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Manage subscription',
              onPress: async () => {
                try {
                  await openManageSubscriptions();
                  refreshTier?.();
                } catch (e) {
                  Alert.alert('Error', e.message || 'Could not open subscription management');
                }
              },
            },
          ]
        );
      } else if (result?.alreadyOwned) {
        refreshTier?.();
        const alert = getRestoreSubscriptionAlert(result.restoreResult);
        if (alert) setRestoreAlert(alert);
      } else if (result?.unavailable) {
        Alert.alert('Premium', result.message || 'Subscriptions are not available on this device.');
      } else if (result?.started && result.outcomePromise) {
        const out = await result.outcomePromise;
        refreshTier?.();
        if (out.status === 'failed') {
          const alert = out.restoreResult
            ? getRestoreSubscriptionAlert(out.restoreResult)
            : getSubscribeFailureAlert(out.message, { alreadyOwned: out.alreadyOwned });
          if (alert) setRestoreAlert(alert);
        }
      }
    } catch (err) {
      const msg = err.message || 'Could not start subscription';
      Alert.alert(
        'Subscribe failed',
        msg + '\n\nTap "Check setup" to verify server configuration.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Check setup',
            onPress: async () => {
              try {
                const status = await getSubscriptionStatus();
                if (status.configured) {
                  Alert.alert('Setup OK', 'Server has App Store API env vars. If errors persist, check Railway logs and App Store Connect.');
                } else {
                  const missing = Array.isArray(status.missing) ? status.missing : [];
                  const missingList = missing.length > 0
                    ? missing.join(', ')
                    : `Could not determine — open ${API_BASE_URL}/api/subscription/status in a browser`;
                  Alert.alert('Setup incomplete', `Missing on server: ${missingList}\n\nAdd these in Railway → Variables.`);
                }
              } catch (e) {
                Alert.alert('Cannot reach server', e.message || 'Check EXPO_PUBLIC_API_URL and that the server is running.');
              }
            },
          },
        ]
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleRestoreSubscription = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      Alert.alert('Sign in required', 'Please sign in to restore your subscription.');
      return;
    }
    setRestoreLoading(true);
    try {
      const result = await restoreSubscription(session.access_token);
      refreshTier?.();
      const alert = getRestoreSubscriptionAlert(result);
      if (alert) setRestoreAlert(alert);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleGetPairing = async () => {
    const trimmed = cigar.trim();
    if (!trimmed) {
      Alert.alert('Cigar required', "Please enter the cigar you're about to smoke.");
      return;
    }

    setLoading(true);
    setPairings([]);
    try {
      const token = (await supabase?.auth.getSession()).data?.session?.access_token;
      const result = await getDrinkPairing(trimmed, token);
      setPairings(result);
      trackEvent('pairing_requested', { has_result: result.length > 0, count: result.length });
    } catch (err) {
      Alert.alert(
        'Could not get pairing',
        err.message || 'Please try again. Make sure the server is running and OPENAI_API_KEY is set.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openPairingDetail = (pairing) => {
    navigation.navigate('PairingDetail', {
      pairing,
      cigar: cigar.trim(),
    });
  };

  const showUpgrade = tier === 'free' && supabase;

  return (
    <>
      <RestoreSubscriptionResultModal
        alert={restoreAlert}
        onClose={() => setRestoreAlert(null)}
      />
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <FeedbackBtn />
        </View>

        <Text style={styles.title}>Drink Pairing</Text>
        <Text style={styles.subtitle}>
          {showUpgrade ? 'Premium feature' : 'Recommendation'}
        </Text>

        {showUpgrade ? (
          <View style={styles.upgradeBlock}>
            <PremiumCard variant="elevated" contentStyle={styles.upgradeCard}>
              <MaterialCommunityIcons
                name="glass-cocktail"
                size={48}
                color={colors.gold}
                style={styles.upgradeIcon}
              />
              <Text style={styles.upgradeTitle}>Unlock Drink Pairing</Text>
              <Text style={styles.upgradeText}>
                Get AI-powered drink suggestions for every cigar. Subscribe to Premium for $2.99/mo.
              </Text>
            </PremiumCard>
            <CavaroButton
              label="Subscribe for $2.99/mo"
              icon="crown"
              onPress={handleSubscribe}
              loading={checkoutLoading}
              disabled={checkoutLoading}
              style={styles.subscribeBtn}
            />
            <Pressable
              style={styles.restoreLink}
              onPress={handleRestoreSubscription}
              disabled={restoreLoading}
            >
              <Text style={styles.restoreLinkText}>
                {restoreLoading ? 'Restoring…' : 'Already have a subscription? Restore it'}
              </Text>
            </Pressable>
            <SubscriptionLegalLinks compact style={styles.subscriptionLegal} />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
          >
            <Text style={styles.label}>What cigar are you about to smoke?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Padrón 1964 Anniversary, Montecristo No. 2..."
              placeholderTextColor={colors.textSubtle}
              value={cigar}
              onChangeText={setCigar}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <CavaroButton
              label="Get drink pairings"
              icon="glass-cocktail"
              onPress={handleGetPairing}
              loading={loading}
              disabled={!cigar.trim() || loading}
              style={styles.fetchBtn}
            />

            {pairings.length > 0 ? (
              <View style={styles.results}>
                {pairings.map((pairing) => (
                  <DrinkPairingCard
                    key={`${pairing.name}-${pairing.experienceScore}`}
                    name={pairing.name}
                    description={pairing.description}
                    strengthMatch={pairing.strengthMatch}
                    flavorHarmony={pairing.flavorHarmony}
                    experienceScore={pairing.experienceScore}
                    drinkType={pairing.drinkType}
                    onViewDetails={() => openPairingDetail(pairing)}
                  />
                ))}
              </View>
            ) : null}
          </KeyboardAvoidingView>
        )}
      </ScreenContainer>
    </>
  );
}

export default Pairing;

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    minWidth: 72,
  },
  backText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '500',
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.goldMuted,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  fetchBtn: {
    marginBottom: spacing.xl,
  },
  results: {
    gap: spacing.sm,
  },
  upgradeBlock: {
    gap: spacing.md,
  },
  upgradeCard: {
    alignItems: 'center',
  },
  upgradeIcon: {
    marginBottom: spacing.md,
  },
  upgradeTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  upgradeText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  subscribeBtn: {
    marginTop: spacing.sm,
  },
  restoreLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  restoreLinkText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '500',
  },
  subscriptionLegal: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});
