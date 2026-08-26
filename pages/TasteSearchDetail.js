import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import ImageViewerModal from '../components/ImageViewerModal';
import {
  AccentCard,
  CavaroBadge,
  CavaroButton,
  CigarImage,
  PremiumCard,
  ScreenContainer,
  SegmentMeter,
} from '../components/ui';
import CatalogNotesCard from '../components/taste/CatalogNotesCard';
import { QuickAddSheet } from '../components/humidors';
import { analyzeCigarTaste } from '../api/taste';
import { FREE_CIGAR_LIMIT } from '../constants/limits';
import { useAuth } from '../context/AuthContext';
import { addCigarToHumidor, getHumidors } from '../db';
import { useResolvedCigarImage } from '../hooks/useResolvedCigarImage';
import { hapticSuccess } from '../lib/haptics';
import { scheduleFullPush } from '../lib/userCigarsSync';
import { trackCigarAdded, trackEvent } from '../lib/analytics';
import { getCigarMatch } from '../lib/tasteProfile';
import { enrichCigarForMatch, extractFlavorNotes, loadPalateContext } from '../lib/tasteSearch';
import { explainCigarMatch, humanizeMatchReason } from '../lib/matchExplanation';
import { borderRadius, colors, spacing, typography } from '../theme';

const MATCH_TONES = {
  gold: {
    accent: colors.gold,
    icon: 'star-four-points',
    iconBg: 'rgba(200, 164, 93, 0.16)',
    iconColor: colors.gold,
    watermark: 'star-four-points-outline',
    watermarkColor: 'rgba(200, 164, 93, 0.1)',
    badge: 'gold',
    verdict: 'Strong fit',
  },
  success: {
    accent: colors.success,
    icon: 'thumb-up-outline',
    iconBg: 'rgba(126, 159, 109, 0.16)',
    iconColor: colors.success,
    watermark: 'check-decagram-outline',
    watermarkColor: 'rgba(126, 159, 109, 0.1)',
    badge: 'success',
    verdict: 'Likely fit',
  },
  warning: {
    accent: colors.warning,
    icon: 'scale-balance',
    iconBg: 'rgba(196, 154, 74, 0.16)',
    iconColor: colors.warning,
    watermark: 'help-circle-outline',
    watermarkColor: 'rgba(196, 154, 74, 0.1)',
    badge: 'warning',
    verdict: 'Mixed',
  },
  danger: {
    accent: colors.danger,
    icon: 'close-circle-outline',
    iconBg: 'rgba(184, 92, 74, 0.16)',
    iconColor: colors.danger,
    watermark: 'close-circle-outline',
    watermarkColor: 'rgba(184, 92, 74, 0.1)',
    badge: 'danger',
    verdict: 'Unlikely',
  },
  muted: {
    accent: colors.goldMuted,
    icon: 'compass-outline',
    iconBg: 'rgba(143, 116, 64, 0.16)',
    iconColor: colors.goldMuted,
    watermark: 'compass-outline',
    watermarkColor: 'rgba(143, 116, 64, 0.1)',
    badge: 'muted',
    verdict: 'Unclear',
  },
};

function palateMeterValue(score) {
  if (typeof score !== 'number') return 0;
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

function SectionHeading({ icon, label, trailing }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.gold} />
      </View>
      <Text style={[styles.sectionLabel, styles.sectionLabelFill]}>{label}</Text>
      {trailing}
    </View>
  );
}

export default function TasteSearchDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tier, supabase, refreshTier } = useAuth();
  const {
    cigar,
    flavors: initialFlavors,
    match: initialMatch,
    hasPalate: initialHasPalate,
    autoAnalyze,
  } = route.params ?? {};

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [palate, setPalate] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    visible: false,
    message: '',
    accessToken: null,
    userId: null,
  });
  const [viewerOpen, setViewerOpen] = useState(false);
  const [humidors, setHumidors] = useState([]);
  const [quickAdd, setQuickAdd] = useState({ visible: false, mode: 'picker', confirmation: null });
  const [busyHumidorId, setBusyHumidorId] = useState(null);
  const didAutoAnalyze = useRef(false);
  const resolvedAssets = useResolvedCigarImage(cigar);

  useFocusEffect(
    useCallback(() => {
      refreshTier?.();
      loadPalateContext()
        .then(setPalate)
        .catch(() => setPalate(null));
      getHumidors()
        .then(setHumidors)
        .catch(() => setHumidors([]));
    }, [refreshTier])
  );

  const showUpgrade = (message) => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        Alert.alert('Sign in required', 'Please sign in to subscribe to Premium.');
        return;
      }
      setUpgradeModal({
        visible: true,
        message,
        accessToken: session.access_token,
        userId: session.user?.id,
      });
    });
  };

  const runAnalyze = useCallback(async () => {
    if (!cigar) return;
    if (tier === 'free') {
      showUpgrade('Subscribe to Premium for $2.99/mo to unlock AI tasting notes and palate fit.');
      return;
    }

    setAnalyzing(true);
    try {
      const token = (await supabase?.auth.getSession())?.data?.session?.access_token ?? null;
      const cigarLabel = [cigar.brand, cigar.line, cigar.name].filter(Boolean).join(' ');
      const result = await analyzeCigarTaste({
        cigar: cigarLabel,
        catalog: cigar,
        palate: palate?.hasPalate ? palate.profile : null,
      }, token);
      setAnalysis(result);
      trackEvent('taste_analyzed', {
        has_result: Boolean(result?.summary),
        correlates: Boolean(result?.correlates),
      });
    } catch (err) {
      if (err.code === 'PREMIUM_REQUIRED') {
        showUpgrade('Subscribe to Premium for $2.99/mo to unlock AI tasting notes.');
        return;
      }
      Alert.alert('Could not analyze taste', err.message || 'Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [cigar, palate, supabase, tier]);

  useEffect(() => {
    if (
      autoAnalyze
      && cigar
      && tier === 'premium'
      && !analysis
      && palate
      && !analyzing
      && !didAutoAnalyze.current
    ) {
      didAutoAnalyze.current = true;
      runAnalyze();
    }
  }, [autoAnalyze, analysis, analyzing, cigar, palate, runAnalyze, tier]);

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

  const flavors = [...new Set([
    ...(analysis?.flavors ?? []),
    ...(initialFlavors ?? []),
    ...extractFlavorNotes(cigar),
  ])];
  const hasPalate = initialHasPalate || palate?.hasPalate;
  const match = palate?.hasPalate
    ? getCigarMatch(
      enrichCigarForMatch(cigar, analysis?.flavors ?? initialFlavors ?? []),
      palate.profile,
      palate.entries,
      palate.confidence
    )
    : initialMatch;
  const matchExplanation = explainCigarMatch(match, palate?.confidence);
  const tone = MATCH_TONES[matchExplanation?.tone] ?? MATCH_TONES.muted;
  const name = cigar.name || 'Unknown';
  const brandLabel = cigar.brand?.trim() || null;
  const lineLabel = cigar.line?.trim() && cigar.line.trim().toLowerCase() !== name.trim().toLowerCase()
    ? cigar.line.trim()
    : null;
  const heroChips = [
    cigar.length ? { key: 'size', label: String(cigar.length) } : null,
    cigar.wrapper ? { key: 'wrapper', label: `${cigar.wrapper} wrapper` } : null,
  ].filter(Boolean);
  const isPremium = tier === 'premium';
  const collectionLabel = [brandLabel, name].filter(Boolean).join(' ');

  const addToCollection = () => {
    trackEvent('add_from_search', { brand: cigar.brand, name: cigar.name });
    navigation.navigate('Humidors', {
      screen: 'AddCigar',
      params: {
        prefillBrand: cigar.brand,
        prefillName: cigar.name,
        prefillLength: cigar.length,
      },
    });
  };

  const closeQuickAdd = () => setQuickAdd({ visible: false, mode: 'picker', confirmation: null });

  const runQuickAdd = async (humidor) => {
    setBusyHumidorId(humidor.id);
    try {
      const result = await addCigarToHumidor({
        cigar: { ...cigar, image: resolvedAssets.imageUrl || '' },
        humidorId: humidor.id,
        limitNewRowsTo: tier === 'free' && supabase ? FREE_CIGAR_LIMIT : null,
      });
      scheduleFullPush(supabase);
      hapticSuccess();
      trackCigarAdded({
        source: 'quick_add',
        brand: cigar.brand,
        name: cigar.name,
        line: cigar.line,
        length: cigar.length,
        quantity: 1,
      });
      trackEvent('quick_add_from_search', {
        brand: cigar.brand,
        name: cigar.name,
        incremented: result.incremented,
        humidor_count: humidors.length,
      });
      getHumidors().then(setHumidors).catch(() => {});
      setQuickAdd({
        visible: true,
        mode: 'confirm',
        confirmation: {
          cigarLabel: collectionLabel,
          humidorName: humidor.name,
          incremented: result.incremented,
          quantity: result.quantity,
        },
      });
    } catch (err) {
      closeQuickAdd();
      if (err.code === 'CIGAR_LIMIT_REACHED') {
        showUpgrade(
          `Free includes ${FREE_CIGAR_LIMIT} cigars. Subscribe to Premium for $2.99/mo for unlimited inventory.`
        );
        return;
      }
      if (err.code === 'INCOMPLETE_CIGAR') {
        Alert.alert(
          'Needs a size first',
          'Cavaro needs this cigar\u2019s size before it can be stored. Add it on the full form.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: addToCollection },
          ]
        );
        return;
      }
      Alert.alert('Could not add cigar', err.message || 'Please try again.');
    } finally {
      setBusyHumidorId(null);
    }
  };

  const startQuickAdd = () => {
    if (busyHumidorId != null) return;
    if (!humidors.length) {
      Alert.alert(
        'No humidor yet',
        'Create a humidor in your collection and Cavaro can start storing cigars for you.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Go to Humidors',
            onPress: () => navigation.navigate('Humidors', { screen: 'CavaroList' }),
          },
        ]
      );
      return;
    }
    if (humidors.length === 1) {
      runQuickAdd(humidors[0]);
      return;
    }
    setQuickAdd({ visible: true, mode: 'picker', confirmation: null });
  };

  return (
    <>
      <UpgradeToPremiumModal
        visible={upgradeModal.visible}
        message={upgradeModal.message}
        onClose={() => setUpgradeModal((prev) => ({ ...prev, visible: false }))}
        accessToken={upgradeModal.accessToken}
        userId={upgradeModal.userId}
        tier={tier}
        refreshTier={refreshTier}
      />
      <ImageViewerModal
        visible={viewerOpen}
        imageUri={resolvedAssets.imageUrl}
        onClose={() => setViewerOpen(false)}
      />
      <QuickAddSheet
        visible={quickAdd.visible}
        mode={quickAdd.mode}
        cigarLabel={collectionLabel}
        humidors={humidors}
        confirmation={quickAdd.confirmation}
        busyHumidorId={busyHumidorId}
        onSelectHumidor={runQuickAdd}
        onClose={closeQuickAdd}
      />
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Taste Profile</Text>
          <Pressable
            onPress={startQuickAdd}
            style={styles.headerAction}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} to a humidor`}
          >
            <MaterialCommunityIcons name="plus" size={24} color={colors.gold} />
          </Pressable>
        </View>

        <PremiumCard variant="elevated" padding={0} style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Pressable
              style={styles.heroRail}
              onPress={() => resolvedAssets.imageUrl && setViewerOpen(true)}
              disabled={!resolvedAssets.imageUrl}
              accessibilityRole="imagebutton"
              accessibilityLabel={resolvedAssets.imageUrl ? `View photo of ${name}` : name}
            >
              <CigarImage
                imageUrl={resolvedAssets.imageUrl}
                wrapper={resolvedAssets.wrapper}
                variant="hero"
                style={styles.heroImage}
                imageStyle={styles.heroImage}
              />
              {resolvedAssets.imageUrl ? (
                <View style={styles.heroHint} pointerEvents="none">
                  <MaterialCommunityIcons name="fullscreen" size={16} color={colors.goldMuted} />
                </View>
              ) : null}
            </Pressable>
            <View style={styles.heroBody}>
              {brandLabel ? (
                <Text style={styles.brand} numberOfLines={1}>{brandLabel}</Text>
              ) : null}
              <Text style={styles.name} numberOfLines={3}>{name}</Text>
              {lineLabel ? (
                <Text style={styles.meta} numberOfLines={1}>{lineLabel}</Text>
              ) : null}
              {heroChips.length ? (
                <View style={styles.heroChips}>
                  {heroChips.map((chip) => (
                    <CavaroBadge key={chip.key} label={chip.label} variant="muted" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </PremiumCard>

        <CatalogNotesCard
          text={cigar.description}
          source={brandLabel}
          style={styles.sectionCard}
        />

        {match ? (
          <AccentCard
            accentColor={tone.accent}
            variant="warm"
            watermarkIcon={tone.watermark}
            watermarkColor={tone.watermarkColor}
            style={styles.sectionCard}
            bodyStyle={styles.accentBody}
          >
            <View style={styles.matchHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: tone.iconBg }]}>
                <MaterialCommunityIcons name={tone.icon} size={18} color={tone.iconColor} />
              </View>
              <View style={styles.matchHeading}>
                <Text style={styles.sectionLabel}>For you</Text>
                <CavaroBadge label={tone.verdict} variant={tone.badge} />
              </View>
            </View>

            <Text style={styles.matchHeadline}>
              {matchExplanation?.headline || 'How this fits your palate'}
            </Text>
            {matchExplanation?.detail ? (
              <Text style={styles.matchDetail}>{matchExplanation.detail}</Text>
            ) : null}

            <View style={styles.fitBlock}>
              <View style={styles.fitTop}>
                <Text style={styles.fitLabel}>Palate fit</Text>
                <Text style={styles.fitValue}>{palateMeterValue(match.score)} of 5</Text>
              </View>
              <SegmentMeter value={palateMeterValue(match.score)} />
            </View>

            {match.reasons?.length ? (
              <View style={styles.reasonList}>
                <Text style={styles.subLabel}>What lines up</Text>
                {match.reasons.slice(0, 4).map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.goldMuted} />
                    <Text style={styles.reasonText}>{humanizeMatchReason(reason)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {!hasPalate ? (
              <Text style={styles.footnote}>
                Journal a few smokes to make this match more confident.
              </Text>
            ) : null}
          </AccentCard>
        ) : (
          <PremiumCard variant="subtle" style={styles.sectionCard}>
            <SectionHeading icon="notebook-outline" label="Your palate" />
            <Text style={styles.bodyMuted}>
              Log tasting notes in your journal and Cavaro will tell you whether this cigar is likely your style.
            </Text>
          </PremiumCard>
        )}

        <PremiumCard variant="subtle" style={styles.sectionCard}>
          <SectionHeading
            icon="palette-outline"
            label="Likely flavors"
            trailing={flavors.length > 0 ? (
              <Text style={styles.sectionCount}>{flavors.length}</Text>
            ) : null}
          />
          {flavors.length > 0 ? (
            <View style={styles.flavorRow}>
              {flavors.map((flavor) => (
                <CavaroBadge key={flavor} label={flavor} variant="gold" />
              ))}
            </View>
          ) : (
            <Text style={styles.bodyMuted}>
              Not enough published notes yet. Premium can generate a tasting profile for this cigar.
            </Text>
          )}
          {analysis?.strength ? (
            <View style={styles.strengthRow}>
              <MaterialCommunityIcons name="fire" size={16} color={colors.goldMuted} />
              <Text style={styles.strengthLabel}>Typical strength</Text>
              <Text style={styles.strengthValue}>{analysis.strength}</Text>
            </View>
          ) : null}
        </PremiumCard>

        {analysis ? (
          <PremiumCard variant="warm" style={styles.sectionCard}>
            <SectionHeading
              icon="auto-fix"
              label="Tasting notes"
              trailing={<CavaroBadge label="AI" variant="gold" style={styles.headingBadge} />}
            />
            <Text style={styles.summary}>{analysis.summary}</Text>
            {analysis.details ? <Text style={styles.bodyText}>{analysis.details}</Text> : null}
            {analysis.palateFit ? (
              <View style={styles.palateFitBlock}>
                <MaterialCommunityIcons
                  name="account-heart-outline"
                  size={16}
                  color={colors.goldBright}
                  style={styles.palateFitIcon}
                />
                <Text style={styles.palateFit}>{analysis.palateFit}</Text>
              </View>
            ) : null}
          </PremiumCard>
        ) : (
          <PremiumCard variant="warm" style={styles.sectionCard}>
            <SectionHeading
              icon="auto-fix"
              label="Tasting notes"
              trailing={isPremium
                ? null
                : <CavaroBadge label="Premium" variant="gold" style={styles.headingBadge} />}
            />
            <Text style={styles.bodyMuted}>
              {isPremium
                ? 'Get a concise flavor profile for this cigar, scored against what you already like.'
                : 'Premium unlocks AI tasting notes and a written take on whether this cigar fits your palate.'}
            </Text>
            <CavaroButton
              label={isPremium ? 'Get tasting notes' : 'Unlock tasting notes'}
              icon={isPremium ? 'cigar' : 'crown'}
              onPress={runAnalyze}
              loading={analyzing}
              disabled={analyzing}
              style={styles.analyzeBtn}
            />
          </PremiumCard>
        )}

        <CavaroButton
          label="Add to collection"
          icon="plus"
          variant="secondary"
          onPress={addToCollection}
        />
        <Text style={styles.footerHint}>
          Journaling this smoke sharpens every match Cavaro makes for you.
        </Text>
      </ScreenContainer>
    </>
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
  headerAction: {
    minWidth: 72,
    alignItems: 'flex-end',
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
  brand: {
    ...typography.label,
    color: colors.goldBright,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  accentBody: {
    padding: spacing.lg,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.goldMuted,
  },
  sectionLabelFill: {
    flex: 1,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  matchHeading: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.textSubtle,
  },
  headingBadge: {
    alignSelf: 'center',
  },
  subLabel: {
    ...typography.label,
    color: colors.textSubtle,
    marginBottom: spacing.xs,
  },
  matchHeadline: {
    ...typography.sectionTitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  matchDetail: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  fitBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(13, 11, 9, 0.35)',
  },
  fitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fitLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  fitValue: {
    ...typography.caption,
    color: colors.goldBright,
    fontWeight: '600',
  },
  reasonList: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reasonText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    flex: 1,
  },
  footnote: {
    ...typography.caption,
    color: colors.textSubtle,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  flavorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  strengthLabel: {
    ...typography.label,
    color: colors.textMuted,
    flex: 1,
  },
  strengthValue: {
    ...typography.caption,
    color: colors.goldBright,
    fontWeight: '600',
  },
  summary: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bodyText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 24,
  },
  bodyMuted: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  palateFitBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200, 164, 93, 0.22)',
  },
  palateFitIcon: {
    marginTop: 3,
  },
  palateFit: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.goldBright,
    flex: 1,
  },
  analyzeBtn: {
    marginTop: spacing.md,
  },
  footerHint: {
    ...typography.caption,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
