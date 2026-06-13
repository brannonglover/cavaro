import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeedbackBtn from '../components/FeedbackBtn';
import { getDrinkPairing } from '../api/pairing';
import { subscribeOrManage, getSubscriptionStatus, restoreSubscription } from '../api/subscription';
import { openManageSubscriptions } from '../lib/iap';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import colors from '../theme/colors';
import SubscriptionLegalLinks from '../components/SubscriptionLegalLinks';
import RestoreSubscriptionResultModal, {
  getRestoreSubscriptionAlert,
  getSubscribeFailureAlert,
} from '../components/RestoreSubscriptionResultModal';

function Pairing() {
  const { tier, supabase, refreshTier } = useAuth();
  const [cigar, setCigar] = useState('');

  // Refresh tier when screen gains focus (e.g. after returning from subscription UI)
  useFocusEffect(
    React.useCallback(() => {
      refreshTier?.();
    }, [refreshTier])
  );
  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreAlert, setRestoreAlert] = useState(null);

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
      Alert.alert('Cigar required', 'Please enter the cigar you\'re about to smoke.');
      return;
    }

    setLoading(true);
    setPairing(null);
    try {
      const token = (await supabase?.auth.getSession()).data?.session?.access_token;
      const result = await getDrinkPairing(trimmed, token);
      setPairing(result);
      trackEvent('pairing_requested', { has_result: !!result });
    } catch (err) {
      Alert.alert('Could not get pairing', err.message || 'Please try again. Make sure the server is running and OPENAI_API_KEY is set.');
    } finally {
      setLoading(false);
    }
  };

  // Free tier: show upgrade prompt (when Supabase is configured)
  const showUpgrade = tier === 'free' && supabase;
  if (showUpgrade) {
    return (
      <>
        <RestoreSubscriptionResultModal
          alert={restoreAlert}
          onClose={() => setRestoreAlert(null)}
        />
        <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Drink Pairing</Text>
              <Text style={styles.subtitle}>Premium feature</Text>
            </View>
            <FeedbackBtn />
          </View>
          <View style={styles.content}>
            <View style={styles.upgradeCard}>
              <MaterialCommunityIcons name="glass-cocktail" size={48} color={colors.primary} style={styles.upgradeIcon} />
              <Text style={styles.upgradeTitle}>Unlock Drink Pairing</Text>
              <Text style={styles.upgradeText}>
                Get AI-powered drink suggestions for every cigar. Subscribe to Premium for $2.99/mo.
              </Text>
            </View>
            <Pressable
              style={[styles.button, checkoutLoading && styles.buttonDisabled]}
              onPress={handleSubscribe}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="crown" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Subscribe for $2.99/mo</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={styles.restoreLink}
              onPress={handleRestoreSubscription}
              disabled={restoreLoading}
            >
              {restoreLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.restoreLinkText}>Already have a subscription? Restore it</Text>
              )}
            </Pressable>
            <SubscriptionLegalLinks compact style={styles.subscriptionLegalInline} />
          </View>
        </SafeAreaView>
      </View>
      </>
    );
  }

  return (
    <>
      <RestoreSubscriptionResultModal
        alert={restoreAlert}
        onClose={() => setRestoreAlert(null)}
      />
      <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Drink Pairing</Text>
            <Text style={styles.subtitle}>AI-powered suggestions</Text>
          </View>
          <FeedbackBtn />
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
          collapsable={false}
        >
          <Text style={styles.label}>What cigar are you about to smoke?</Text>
          <View collapsable={false}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Padrón 1964 Anniversary, Montecristo No. 2..."
              placeholderTextColor={colors.placeholderText}
              value={cigar}
              onChangeText={setCigar}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={[styles.button, (!cigar.trim() || loading) && styles.buttonDisabled]}
            onPress={handleGetPairing}
            disabled={!cigar.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="glass-cocktail" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Get drink pairings</Text>
              </>
            )}
          </Pressable>

          {pairing && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Suggested pairings</Text>
              <ScrollView
                style={styles.resultScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={styles.resultText}>{pairing}</Text>
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
    </>
  );
}

export default Pairing;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  resultCard: {
    marginTop: 24,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    flex: 1,
    minHeight: 120,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  resultScroll: {
    flex: 1,
  },
  resultText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  upgradeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionLegalInline: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 0,
  },
  upgradeIcon: {
    marginBottom: 16,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  upgradeText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  restoreLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreLinkText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
});
