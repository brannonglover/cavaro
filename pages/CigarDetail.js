import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AccentCard,
  CavaroButton,
  CigarImage,
  MatchBadge,
  PremiumCard,
  ScreenContainer,
} from '../components/ui';
import ImageViewerModal from '../components/ImageViewerModal';
import { getCatalogDetailsForCigar } from '../lib/cigarImage';
import { borderRadius, colors, spacing, typography } from '../theme';

function pickValue(...values) {
  for (const value of values) {
    const trimmed = value?.trim?.() ?? value;
    if (trimmed) return trimmed;
  }
  return null;
}

function getRecommendationHighlights(reasons) {
  return (reasons ?? []).filter((reason) => {
    const lower = reason.toLowerCase();
    return (
      !lower.includes('not preferred')
      && !lower.includes('mismatch')
      && !lower.includes('low rating')
      && !lower.includes('disliked')
      && !lower.includes('too mild')
      && !lower.includes('too strong')
    );
  });
}

export default function CigarDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { cigar, recommendation, imageUrl, displayWrapper } = route.params ?? {};
  const [details, setDetails] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!cigar) return;
    getCatalogDetailsForCigar(cigar)
      .then(setDetails)
      .catch(() => setDetails(null));
  }, [cigar]);

  if (!cigar) {
    return (
      <ScreenContainer>
        <View style={styles.fallback}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.fallbackText}>Cigar not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const name = cigar.name || 'Unknown';
  const brand = pickValue(cigar.brand, details?.brand);
  const line = pickValue(cigar.line, details?.line);
  const size = pickValue(cigar.length, details?.length);
  const description = pickValue(cigar.description, details?.description);
  const wrapper = pickValue(cigar.wrapper, displayWrapper, details?.wrapper);
  const binder = pickValue(cigar.binder, details?.binder);
  const filler = pickValue(cigar.filler, details?.filler);
  const meta = [brand, line].filter(Boolean).join(' · ');
  const highlights = getRecommendationHighlights(recommendation?.reasons);
  const hasBlend = wrapper || binder || filler;

  return (
    <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Cigar Details</Text>
        <View style={styles.backBtn} />
      </View>

      <PremiumCard variant="elevated" padding={0} style={styles.heroCard}>
        <Pressable
          style={styles.heroMedia}
          onPress={() => imageUrl && setViewerOpen(true)}
          disabled={!imageUrl}
        >
          <CigarImage
            imageUrl={imageUrl}
            wrapper={wrapper}
            variant="hero"
            style={styles.heroImage}
            imageStyle={styles.heroImage}
            resizeMode="contain"
          />
          <View style={styles.heroOverlay} pointerEvents="none" />
          {imageUrl ? (
            <View style={styles.heroHint} pointerEvents="none">
              <MaterialCommunityIcons name="fullscreen" size={16} color={colors.goldMuted} />
              <Text style={styles.heroHintText}>Tap to view</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.heroBody}>
          <Text style={styles.name}>{name}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          {size ? <Text style={styles.size}>Size {size}</Text> : null}
        </View>
      </PremiumCard>

      {recommendation?.reason ? (
        <AccentCard
          accentColor={colors.gold}
          variant="warm"
          watermarkIcon="star-four-points-outline"
          watermarkColor="rgba(200, 164, 93, 0.1)"
          style={styles.sectionCard}
          bodyStyle={styles.recommendationBody}
        >
          <View style={styles.recommendationHeader}>
            <View style={styles.recommendationIcon}>
              <MaterialCommunityIcons name="cigar" size={18} color={colors.gold} />
            </View>
            <View style={styles.recommendationHeading}>
              <Text style={styles.sectionLabel}>Why tonight's pick</Text>
              {recommendation.level ? (
                <MatchBadge level={recommendation.level} />
              ) : null}
            </View>
          </View>
          <Text style={styles.recommendationReason}>{recommendation.reason}</Text>
          {highlights.length > 0 ? (
            <View style={styles.highlightList}>
              {highlights.map((item) => (
                <View key={item} style={styles.highlightRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.goldMuted} />
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {typeof recommendation.score === 'number' ? (
            <Text style={styles.matchScore}>Match score {recommendation.score}</Text>
          ) : null}
        </AccentCard>
      ) : null}

      {description ? (
        <PremiumCard variant="subtle" style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.bodyText}>{description}</Text>
        </PremiumCard>
      ) : null}

      {hasBlend ? (
        <PremiumCard variant="subtle" style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Blend</Text>
          {wrapper ? (
            <Text style={styles.blendLine}>
              <Text style={styles.blendLabel}>Wrapper: </Text>
              {wrapper}
            </Text>
          ) : null}
          {binder ? (
            <Text style={styles.blendLine}>
              <Text style={styles.blendLabel}>Binder: </Text>
              {binder}
            </Text>
          ) : null}
          {filler ? (
            <Text style={styles.blendLine}>
              <Text style={styles.blendLabel}>Filler: </Text>
              {filler}
            </Text>
          ) : null}
        </PremiumCard>
      ) : null}

      <PremiumCard variant="warm" style={styles.sectionCard}>
        <View style={styles.pairingHeader}>
          <View style={styles.pairingIcon}>
            <MaterialCommunityIcons name="glass-cocktail" size={18} color={colors.gold} />
          </View>
          <View style={styles.pairingCopy}>
            <Text style={styles.sectionLabel}>Drink Pairing</Text>
            <Text style={styles.pairingBlurb}>
              Get AI drink suggestions that complement this cigar.
            </Text>
          </View>
        </View>
        <CavaroButton
          label="Get drink pairing"
          icon="glass-cocktail"
          onPress={() => {
            const pairingQuery = [brand, name].filter(Boolean).join(' ').trim() || name;
            navigation.navigate('Pairing', { cigar: pairingQuery });
          }}
          style={styles.pairingBtn}
        />
      </PremiumCard>

      <ImageViewerModal
        visible={viewerOpen}
        imageUri={imageUrl}
        onClose={() => setViewerOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backBtn: {
    minWidth: 72,
  },
  backText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '500',
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  fallbackText: {
    ...typography.body,
    color: colors.textMuted,
  },
  heroCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroMedia: {
    height: 320,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 9, 0.08)',
  },
  heroHint: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(13, 11, 9, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  heroHintText: {
    ...typography.caption,
    color: colors.goldMuted,
  },
  heroBody: {
    padding: spacing.md,
    backgroundColor: colors.surfaceWarm,
  },
  name: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.goldBright,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  size: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.goldMuted,
    marginBottom: spacing.sm,
  },
  bodyText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  recommendationBody: {
    padding: spacing.md,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  recommendationReason: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  highlightList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  highlightText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    flex: 1,
  },
  matchScore: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.sm,
  },
  blendLine: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  blendLabel: {
    color: colors.textMuted,
  },
  pairingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pairingIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingCopy: {
    flex: 1,
  },
  pairingBlurb: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  pairingBtn: {
    alignSelf: 'stretch',
  },
});
