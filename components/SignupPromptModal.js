import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoldButton } from './ui';
import { trackEvent } from '../lib/analytics';
import { borderRadius, colors, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SignupPromptModal({ visible, cigarCount, onSignUp, onDismiss }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!visible) return;
    trackEvent('guest_signup_prompt_viewed', { cigar_count: cigarCount ?? 0 });
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
  }, [visible, overlayOpacity, sheetTranslateY]);

  const handleClose = (done) => {
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
    ]).start(() => done?.());
  };

  const handleSignUp = (method) => {
    trackEvent('guest_signup_method_selected', { method, cigar_count: cigarCount ?? 0 });
    handleClose(() => onSignUp?.(method));
  };

  const handleNotNow = () => {
    trackEvent('guest_signup_dismissed', { cigar_count: cigarCount ?? 0 });
    handleClose(() => onDismiss?.());
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleNotNow} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.iconRing}>
            <MaterialCommunityIcons name="check-circle" size={32} color={colors.gold} />
          </View>

          <Text style={styles.title}>You've started your collection!</Text>
          <Text style={styles.subtitle}>
            Your first cigar has been added to Cavaro.{'\n'}
            Create a free account to keep your collection backed up and available across your devices.
          </Text>

          {Platform.OS === 'ios' && (
            <GoldButton
              title="Continue with Apple"
              onPress={() => handleSignUp('apple')}
              variant="primary"
              style={styles.authBtn}
            />
          )}

          <GoldButton
            title="Continue with Google"
            onPress={() => handleSignUp('google')}
            variant="primary"
            style={styles.authBtn}
          />

          <GoldButton
            title="Continue with Email"
            onPress={() => handleSignUp('email')}
            variant="secondary"
            style={styles.authBtn}
          />

          <Pressable onPress={handleNotNow} style={styles.notNowBtn} hitSlop={12}>
            <Text style={styles.notNowText}>Not Now</Text>
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 4, 3, 0.72)',
  },
  sheet: {
    backgroundColor: colors.surface || colors.cardBg,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 16,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  authBtn: {
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  notNowBtn: {
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  notNowText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
