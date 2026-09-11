import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoldButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import { colors, spacing, typography } from '../theme';

const logo = require('../assets/logo-wd.png');

const VALUE_PROPS = [
  { icon: 'magnify', text: 'Discover cigars that match your palate' },
  { icon: 'bookshelf', text: 'Track your collection and humidor' },
  { icon: 'notebook-outline', text: 'Log tasting notes and build your profile' },
];

export default function Welcome({ onExplore, onSignIn }) {
  const { enterGuestMode } = useAuth();

  useEffect(() => {
    trackEvent('onboarding_viewed');
  }, []);

  const handleExplore = async () => {
    trackEvent('explore_as_guest');
    await enterGuestMode();
    onExplore?.();
  };

  const handleSignIn = () => {
    trackEvent('existing_user_signin_selected');
    onSignIn?.();
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.hero}>
            <Image
              source={logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Cavaro"
            />
            <Text style={styles.tagline}>
              Discover cigars, track what you've smoked,{'\n'}and build your collection.
            </Text>
          </View>

          <View style={styles.valueProps}>
            {VALUE_PROPS.map((item, i) => (
              <View key={i} style={styles.valuePropRow}>
                <View style={styles.iconRing}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={colors.gold}
                  />
                </View>
                <Text style={styles.valuePropText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <GoldButton
              title="Explore Cavaro"
              onPress={handleExplore}
              variant="primary"
            />
            <GoldButton
              title="I already have an account"
              onPress={handleSignIn}
              variant="secondary"
              style={styles.secondaryBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + spacing.xl : spacing.xl,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    height: 72,
    width: 270,
    marginBottom: spacing.md,
  },
  tagline: {
    ...typography.body,
    color: '#ebe4d8',
    textAlign: 'center',
    lineHeight: 22,
  },
  valueProps: {
    gap: 18,
    marginBottom: 48,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3D2E1E',
    borderWidth: 1,
    borderColor: colors.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropText: {
    ...typography.body,
    color: '#ebe4d8',
    fontSize: 15,
    flex: 1,
  },
  actions: {
    gap: 12,
  },
  secondaryBtn: {
    marginTop: 4,
  },
});
