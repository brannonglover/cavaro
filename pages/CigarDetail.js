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
import { useResolvedCigarImage } from '../hooks/useResolvedCigarImage';
import { getCatalogDetailsForCigar } from '../lib/cigarImage';
import { explainCigarMatch, humanizeMatchReason } from '../lib/matchExplanation';
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
  const resolvedPhoto = useResolvedCigarImage(
    cigar
      ? { ...cigar, image: imageUrl || cigar.image, wrapper: displayWrapper || cigar.wrapper }
      : null
  );

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
  const wrapper = pickValue(cigar.wrapper, displayWrapper, resolvedPhoto.wrapper, details?.wrapper);
  const photoUrl = resolvedPhoto.imageUrl;
  const binder = pickValue(cigar.binder, details?.binder);
  const filler = pickValue(cigar.filler, details?.filler);
  const meta = [brand, line].filter(Boolean).join(' · ');
  const highlights = getRecommendationHighlights(recommendation?.reasons)
    .map(humanizeMatchReason);
  const hasBlend = wrapper || binder || filler;
  const matchExplanation = recommendation?.level
    ? explainCigarMatch({
      level: recommendation.level,
      reasons: recommendation.reasons,
      score: recommendation.score,
    })
    : null;

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
        <View style={styles.heroRow}>
          <Pressable
            style={styles.heroRail}
            onPress={() => photoUrl && setViewerOpen(true)}
            disabled={!photoUrl}
          >
            <CigarImage
              imageUrl={photoUrl}
              wrapper={wrapper}
              variant="hero"
              style={styles.heroImage}
              imageStyle={styles.heroImage}
            />
            {photoUrl ? (
              <View style={styles.heroHint} pointerEvents="none">
                <MaterialCommunityIcons name="fullscreen" size={16} color={colors.goldMuted} />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.heroBody}>
            <Text style={styles.name}>{name}</Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {size ? <Text style={styles.size}>Size {size}</Text> : null}
          </View>
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
                <MatchBadge
                  level={recommendation.level}
                  label={matchExplanation?.headline}
                />
              ) : null}
            </View>
          </View>
          <Text style={styles.recommendationReason}>
            {matchExplanation?.detail || recommendation.reason}
          </Text>
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
        <View style={styles.tasteHeader}>
          <View style={styles.tasteIcon}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.gold} />
          </View>
          <View style={styles.tasteCopy}>
            <Text style={styles.sectionLabel}>Taste Search</Text>
            <Text style={styles.tasteBlurb}>
              See this cigar's likely flavors and how they line up with your palate.
            </Text>
          </View>
        </View>
        <CavaroButton
          label="Check against my taste"
          icon="magnify"
          onPress={() => {
            navigation.navigate('TasteSearchDetail', {
              cigar: {
                ...cigar,
                brand,
                name,
                line,
                length: size,
                description,
                wrapper,
                binder,
                filler,
                image: photoUrl || cigar.image,
              },
            });
          }}
          style={styles.tasteBtn}
        />
      </PremiumCard>

      <ImageViewerModal
        visible={viewerOpen}
        imageUri={photoUrl}
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
  heroRow: {
    flexDirection: 'row',
    minHeight: 200,
    alignItems: 'stretch',
  },
  heroRail: {
    width: 120,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroHint: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 11, 9, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    justifyContent: 'center',
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
  tasteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tasteIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteCopy: {
    flex: 1,
  },
  tasteBlurb: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  tasteBtn: {
    alignSelf: 'stretch',
  },
});
