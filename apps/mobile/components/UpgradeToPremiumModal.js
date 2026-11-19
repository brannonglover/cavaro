import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { subscribeOrManage, restoreSubscription } from '../api/subscription';
import { openManageSubscriptions } from '../lib/iap';
import SubscriptionLegalLinks from './SubscriptionLegalLinks';
import RestoreSubscriptionResultModal, {
  getRestoreSubscriptionAlert,
  getSubscribeFailureAlert,
} from './RestoreSubscriptionResultModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * @param {string} userId - Supabase user id (UUID for Apple appAccountToken)
 */
export default function UpgradeToPremiumModal({
  visible,
  message = 'Subscribe to Premium for $2.99/mo to unlock this feature.',
  onClose,
  accessToken,
  userId,
  tier,
  refreshTier,
}) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [restoreAlert, setRestoreAlert] = useState(null);

  const clearLoadingState = useCallback(() => {
    setRestoreLoading(false);
    setSubscribeLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      clearLoadingState();
    }
  }, [visible, clearLoadingState]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clearLoadingState();
    });
    return () => sub.remove();
  }, [clearLoadingState]);

  const showRestoreAlertAfterClose = (alert) => {
    if (!alert) return;
    setTimeout(() => setRestoreAlert(alert), 350);
  };

  const handleAlreadyOwnedResult = (restoreResult) => {
    refreshTier?.();
    if (restoreResult?.tier === 'premium' || restoreResult?.restored) {
      handleClose();
      return;
    }
    const alert = getRestoreSubscriptionAlert(restoreResult);
    if (alert) {
      handleClose();
      showRestoreAlertAfterClose(alert);
    }
  };

  useEffect(() => {
    if (visible) {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleRestore = async () => {
    if (!accessToken || restoreLoading || subscribeLoading) return;
    setRestoreLoading(true);
    try {
      const result = await restoreSubscription(accessToken);
      refreshTier?.();
      if (result?.tier === 'premium' || result?.restored) {
        handleClose();
      } else {
        const alert = getRestoreSubscriptionAlert(result);
        handleClose();
        showRestoreAlertAfterClose(alert);
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!accessToken || !userId || subscribeLoading || restoreLoading) return;
    setSubscribeLoading(true);
    try {
      const result = await subscribeOrManage(accessToken, tier, userId);
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
        handleAlreadyOwnedResult(result.restoreResult);
      } else if (result?.unavailable) {
        Alert.alert('Premium', result.message || 'Subscriptions are not available here.');
      } else if (result?.started && result.outcomePromise) {
        const out = await result.outcomePromise;
        if (out.status === 'completed') {
          refreshTier?.();
          handleClose();
        } else if (out.status === 'failed') {
          refreshTier?.();
          if (out.alreadyOwned && out.restoreResult) {
            handleAlreadyOwnedResult(out.restoreResult);
          } else {
            const alert = out.restoreResult
              ? getRestoreSubscriptionAlert(out.restoreResult)
              : getSubscribeFailureAlert(out.message, { alreadyOwned: out.alreadyOwned });
            if (alert) {
              handleClose();
              showRestoreAlertAfterClose(alert);
            }
          }
        }
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not start checkout');
    } finally {
      setSubscribeLoading(false);
    }
  };

  return (
    <>
      <RestoreSubscriptionResultModal
        alert={restoreAlert}
        onClose={() => setRestoreAlert(null)}
      />
      <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents="none"
        />
      </Pressable>
      <View style={styles.centered} pointerEvents="box-none">
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetTranslateY }], borderColor: colors.primary },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
              <MaterialCommunityIcons name="crown" size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.appleIdNote}>
              App Store checkout uses your Apple ID. Your Cavaro email and password are separate.
            </Text>
            <SubscriptionLegalLinks />
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.cancelBtn]}
                onPress={handleClose}
                disabled={restoreLoading || subscribeLoading}
              >
                <Text style={[styles.btnText, styles.cancelText]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.secondaryBtn]}
                onPress={handleRestore}
                disabled={restoreLoading || subscribeLoading}
              >
                {restoreLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.btnText, styles.secondaryBtnText]}>Restore subscription</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.primaryBtn]}
                onPress={handleSubscribe}
                disabled={restoreLoading || subscribeLoading}
              >
                {subscribeLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.btnText, styles.primaryBtnText]}>Subscribe</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  appleIdNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    opacity: 0.85,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelBtn: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  secondaryBtn: {
    borderColor: colors.primary,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnText: {
    fontSize: 17,
    color: colors.textPrimary,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
  primaryBtnText: {
    color: colors.screenBg,
    fontWeight: '600',
  },
});
