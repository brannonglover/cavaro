import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import SubscriptionLegalLinks from '../components/SubscriptionLegalLinks';

const FREE_FEATURES = [
  'Up to 5 cigars',
  'Up to 5 favorites',
  'Basic tasting notes',
];
const PREMIUM_FEATURES = [
  'Unlimited cigars',
  'Unlimited favorites',
  'Strength profile',
  'Photos',
  'AI drink pairings',
];

export default function Landing({ onGetStarted, onSubscribe, onAlreadyHaveAccount, onRestoreSubscription }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image source={require('../assets/logo-wd.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>Your personal cigar companion</Text>
          </View>

          <View style={styles.whySection}>
            <Text style={styles.sectionTitle}>Why Cavaro?</Text>
            <Text style={styles.sectionText}>
              Track your collection, log tasting notes, and discover drink pairings. Access a growing, community-built cigar database that expands with every contribution. Built for cigar enthusiasts who want to get the most from every smoke.
            </Text>
            <View style={styles.benefits}>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.like} />
                <Text style={styles.benefitText}>Growing, community-built cigar database</Text>
              </View>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.like} />
                <Text style={styles.benefitText}>Catalog your collection</Text>
              </View>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.like} />
                <Text style={styles.benefitText}>Favorites & tasting notes</Text>
              </View>
              <View style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.like} />
                <Text style={styles.benefitText}>AI-powered drink pairings</Text>
              </View>
            </View>
          </View>

          <Text style={styles.tiersLabel}>Choose your plan</Text>
          <View style={styles.tiers}>
            <Pressable style={styles.tierCard} onPress={onGetStarted}>
              <Text style={styles.tierTitle}>Free</Text>
              <Text style={styles.tierPrice}>$0</Text>
              <View style={styles.tierFeatures}>
                {FREE_FEATURES.map((f, i) => (
                  <View key={i} style={styles.tierFeatureRow}>
                    <MaterialCommunityIcons name="check" size={18} color={colors.textSecondary} />
                    <Text style={styles.tierFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tierCta}>
                <Text style={styles.tierCtaText}>Get started</Text>
              </View>
            </Pressable>

            <Pressable style={[styles.tierCard, styles.tierCardPremium]} onPress={onSubscribe}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most popular</Text>
              </View>
              <Text style={styles.tierTitle}>Premium</Text>
              <Text style={styles.tierPrice}>$2.99/mo</Text>
              <View style={styles.tierFeatures}>
                {PREMIUM_FEATURES.map((f, i) => (
                  <View key={i} style={styles.tierFeatureRow}>
                    <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
                    <Text style={[styles.tierFeatureText, styles.tierFeatureTextPremium]}>{f}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.tierCta, styles.tierCtaPremium]}>
                <Text style={styles.tierCtaText}>Subscribe</Text>
              </View>
            </Pressable>
          </View>

          <Pressable style={styles.linkBtn} onPress={onAlreadyHaveAccount}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Pressable>
          {onRestoreSubscription && (
            <Pressable style={styles.linkBtn} onPress={onRestoreSubscription}>
              <Text style={styles.linkText}>Restore subscription</Text>
            </Pressable>
          )}

          <View style={styles.legalLinksSpacer} />
          <SubscriptionLegalLinks style={styles.legalLinks} compact />
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 24 : 24,
    paddingBottom: 48,
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    height: 72,
    width: 270,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 6,
  },
  whySection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  benefits: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tiersLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  tiers: {
    gap: 14,
    marginBottom: 8,
  },
  legalLinksSpacer: {
    flexGrow: 1,
    minHeight: 48,
  },
  legalLinks: {
    marginTop: 8,
  },
  tierCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    position: 'relative',
  },
  tierCardPremium: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
  },
  tierFeatures: {
    marginBottom: 16,
    gap: 6,
  },
  tierFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierFeatureText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tierFeatureTextPremium: {
    color: colors.textPrimary,
  },
  tierCta: {
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tierCtaPremium: {
    backgroundColor: colors.primary,
  },
  tierCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  linkBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    color: colors.primary,
  },
});
