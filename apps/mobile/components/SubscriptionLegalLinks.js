import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import colors from '../theme/colors';
import { getTermsOfUseUrl, getPrivacyPolicyUrl } from '../constants/legalUrls';

async function openUrl(url, label) {
  if (!url?.trim()) {
    Alert.alert('Link unavailable', `${label} URL is not configured.`);
    return;
  }
  const trimmed = url.trim();
  try {
    // Open http(s) directly. On iOS, canOpenURL('https://...') is false unless
    // LSApplicationQueriesSchemes includes https — but openURL works regardless (3.1.2).
    await Linking.openURL(trimmed);
  } catch {
    Alert.alert('Could not open link', 'Please try again.');
  }
}

/**
 * Terms + Privacy links for subscription / paywall surfaces (App Store guideline 3.1.2).
 */
export default function SubscriptionLegalLinks({ style, compact }) {
  const termsUrl = getTermsOfUseUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Terms of Use"
        onPress={() => openUrl(termsUrl, 'Terms of Use')}
        hitSlop={8}
      >
        <Text style={styles.link}>Terms of Use</Text>
      </Pressable>
      <Text style={styles.sep}> · </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        onPress={() => openUrl(privacyUrl, 'Privacy Policy')}
        hitSlop={8}
      >
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  rowCompact: {
    marginBottom: 8,
  },
  link: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  sep: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
