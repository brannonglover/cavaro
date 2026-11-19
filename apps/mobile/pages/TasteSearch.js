import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ImageViewerModal from '../components/ImageViewerModal';
import TasteSearchResultsSheet from '../components/taste/TasteSearchResultsSheet';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import {
  CavaroBadge,
  CavaroButton,
  CigarCard,
  PalateFitNote,
  ScreenContainer,
  SegmentedControl,
} from '../components/ui';
import { searchReviewsByTaste } from '../api/reviews';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import { hapticLight } from '../lib/haptics';
import { syncCatalogCache } from '../lib/catalogSync';
import {
  TASTE_SEARCH_FLAVORS,
  blendSizeSummary,
  collapseCigarsByBlend,
  expandTasteKeywords,
  filterCatalogByName,
  filterCatalogByTaste,
  loadLocalCatalog,
  loadPalateContext,
  palateFlavorChips,
  rankCigarsForPalate,
} from '../lib/tasteSearch';
import { canonicalLabelsFromKeywords } from '../lib/tasteVocabulary';
import { borderRadius, colors, spacing, typography } from '../theme';

const MODES = [
  { id: 'taste', label: 'By taste' },
  { id: 'cigar', label: 'By cigar' },
];

function formatList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function searchNoteLabels(applied) {
  if (!applied || applied.mode === 'cigar') return [];
  const notes = [...(applied.flavors ?? [])];
  const extra = applied.query?.trim();
  if (extra && !notes.some((note) => note.toLowerCase() === extra.toLowerCase())) {
    notes.push(extra);
  }
  return notes;
}

function resultsHeading(count, applied) {
  const noun = count === 1 ? 'cigar' : 'cigars';
  if (!applied) return `${count} ${noun}`;
  if (applied.mode === 'cigar') {
    const query = applied.query?.trim();
    return query ? `${count} ${noun} matching “${query}”` : `${count} ${noun}`;
  }
  const notes = searchNoteLabels(applied);
  return notes.length ? `${count} ${noun} with ${formatList(notes)}` : `${count} ${noun}`;
}

function FlavorChips({ selected, onToggle, extras = [] }) {
  const chips = [...new Set([...TASTE_SEARCH_FLAVORS, ...extras])];
  return (
    <View style={styles.chipsWrap}>
      {chips.map((flavor) => {
        const active = selected.includes(flavor);
        return (
          <Pressable
            key={flavor}
            onPress={() => {
              hapticLight();
              onToggle(flavor);
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{flavor}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TasteSearch() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tier, supabase, refreshTier } = useAuth();

  const initialMode = route.params?.mode === 'cigar' ? 'cigar' : 'taste';
  const initialQuery = route.params?.query?.trim?.() || '';

  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [palate, setPalate] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLimitReached, setSearchLimitReached] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    visible: false,
    message: '',
    accessToken: null,
    userId: null,
  });
  const [viewerImage, setViewerImage] = useState(null);
  const [resultsSheetVisible, setResultsSheetVisible] = useState(false);
  const restoreSheetOnFocusRef = useRef(false);

  useEffect(() => {
    if (route.params?.mode === 'cigar') setMode('cigar');
    if (route.params?.query) setQuery(route.params.query);
  }, [route.params?.mode, route.params?.query]);

  useFocusEffect(
    useCallback(() => {
      if (restoreSheetOnFocusRef.current) {
        restoreSheetOnFocusRef.current = false;
        setResultsSheetVisible(true);
      }
      refreshTier?.();
      let cancelled = false;
      (async () => {
        const [nextPalate, nextCatalog] = await Promise.all([
          loadPalateContext().catch(() => null),
          loadLocalCatalog().catch(() => []),
        ]);
        if (cancelled) return;
        setPalate(nextPalate);
        setCatalog(nextCatalog ?? []);
        syncCatalogCache().catch(() => {});
      })();
      return () => {
        cancelled = true;
      };
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

  const toggleFlavor = (flavor) => {
    setSelectedFlavors((prev) =>
      prev.includes(flavor) ? prev.filter((item) => item !== flavor) : [...prev, flavor]
    );
  };

  const runSearch = async (overrides = {}) => {
    const searchMode = overrides.mode ?? mode;
    const searchQuery = overrides.query ?? query;
    const searchFlavors = overrides.flavors ?? selectedFlavors;
    const keywords = searchMode === 'cigar'
      ? (searchQuery.trim() ? searchQuery.trim().split(/[\s,]+/) : [])
      : expandTasteKeywords(
        [...searchFlavors, ...(searchQuery.trim() ? searchQuery.trim().split(/[\s,]+/) : [])]
      );

    if (!keywords.length) {
      Alert.alert(
        searchMode === 'cigar' ? 'Enter a cigar' : 'Choose a taste',
        searchMode === 'cigar'
          ? 'Type a cigar name or brand to see its likely flavors.'
          : 'Pick flavor notes or type what you are looking for.'
      );
      return;
    }

    setLoading(true);
    setSearchLimitReached(false);
    setSignInRequired(false);
    setHasSearched(true);
    setAppliedSearch({
      mode: searchMode,
      flavors: searchFlavors,
      query: searchQuery.trim(),
    });

    try {
      const token = (await supabase?.auth.getSession())?.data?.session?.access_token ?? null;
      const apiKeywords = keywords.filter((keyword) => !String(keyword).includes(' '));
      let rows = [];
      let usedServer = false;
      try {
        rows = await searchReviewsByTaste(
          apiKeywords.length ? apiKeywords : keywords,
          token,
          searchMode === 'cigar' ? 'cigar' : 'taste'
        );
        usedServer = true;
      } catch (err) {
        if (err.code === 'SEARCH_LIMIT_EXCEEDED') {
          setSearchLimitReached(true);
          setResults([]);
          setResultsSheetVisible(false);
          return;
        }
        if (err.code !== 'SIGN_IN_REQUIRED') {
          throw err;
        }
      }

      if (!rows?.length && catalog?.length) {
        rows = searchMode === 'cigar'
          ? filterCatalogByName(catalog, searchQuery)
          : filterCatalogByTaste(catalog, keywords);
        if (!usedServer && !rows.length) {
          setSignInRequired(true);
          setResults([]);
          return;
        }
      }

      const uniqueBlends = collapseCigarsByBlend(rows ?? []);
      const ranked = rankCigarsForPalate(uniqueBlends, palate).slice(0, 25);
      setResults(ranked);
      Keyboard.dismiss();
      setResultsSheetVisible(true);
      trackEvent('search_performed', {
        keyword_count: keywords.length,
        has_results: ranked.length > 0,
        search_type: searchMode,
      });
    } catch (err) {
      console.warn('Taste search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const applyMyPalate = () => {
    const flavors = palateFlavorChips(palate?.profile);
    if (!flavors.length) {
      Alert.alert(
        'Keep journaling',
        'Log a few smokes with flavor notes in My Taste and Cavaro can search from your palate.'
      );
      return;
    }
    setMode('taste');
    setSelectedFlavors(flavors);
    setQuery('');
    runSearch({ mode: 'taste', flavors, query: '' });
  };

  useEffect(() => {
    if (route.params?.autoSearch && (initialQuery || selectedFlavors.length)) {
      runSearch();
    }
    // Run once when arriving with autoSearch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.autoSearch]);

  const openDetail = (item) => {
    restoreSheetOnFocusRef.current = true;
    setViewerImage(null);
    setResultsSheetVisible(false);
    navigation.navigate('TasteSearchDetail', {
      cigar: item.cigar,
      flavors: item.flavors,
      match: item.match,
      hasPalate: Boolean(palate?.hasPalate),
      confidence: palate?.confidence,
    });
  };

  const placeholder = mode === 'cigar'
    ? 'e.g. Padrón 1964, Oliva Serie V...'
    : 'Or type a flavor: cocoa, cedar, pepper...';

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
      <TasteSearchResultsSheet
        visible={resultsSheetVisible}
        title={resultsHeading(results.length, appliedSearch)}
        emptyText={
          mode === 'cigar'
            ? 'No cigars matched that name in the catalog.'
            : 'No cigars matched those flavors. Try fewer notes or a different combination.'
        }
        onClose={() => {
          setViewerImage(null);
          setResultsSheetVisible(false);
        }}
        overlay={(
          <ImageViewerModal
            visible={!!viewerImage}
            imageUri={viewerImage}
            onClose={() => setViewerImage(null)}
          />
        )}
      >
        {results.length > 0 ? results.map((item) => {
          const key = `${item.cigar.brand}-${item.cigar.name}`;
          const searchNotes = searchNoteLabels(appliedSearch);
          const searchNoteSet = new Set(
            [...searchNotes, ...canonicalLabelsFromKeywords(searchNotes)]
              .map((note) => String(note).toLowerCase())
          );
          const matchedNotes = item.flavors.filter((flavor) => (
            searchNoteSet.has(String(flavor).toLowerCase())
          ));
          const otherNotes = item.flavors.filter((flavor) => (
            !searchNoteSet.has(String(flavor).toLowerCase())
          ));
          const whyHere = appliedSearch?.mode === 'cigar'
            ? (appliedSearch.query?.trim() ? `Name match for “${appliedSearch.query.trim()}”` : null)
            : (searchNotes.length ? formatList(matchedNotes.length ? matchedNotes : searchNotes) : null);
          return (
            <CigarCard
              key={key}
              name={item.cigar.name}
              brand={item.cigar.brand}
              line={item.cigar.line}
              vitola={blendSizeSummary(item.cigar, catalog)}
              wrapper={item.cigar.wrapper}
              imageUrl={item.cigar.image}
              imageLayout="portrait"
              onPress={() => openDetail(item)}
              onImagePress={setViewerImage}
              footer={(
                <View style={styles.resultFooter}>
                  {whyHere ? (
                    <View>
                      <Text style={styles.footerLabel}>Why it's here</Text>
                      <Text style={styles.whyHere}>{whyHere}</Text>
                    </View>
                  ) : null}
                  <View>
                    <Text style={styles.footerLabel}>Likely flavors</Text>
                    {item.flavors.length > 0 ? (
                      <View style={styles.resultFlavors}>
                        {[...matchedNotes, ...otherNotes].slice(0, 4).map((flavor) => (
                          <CavaroBadge
                            key={flavor}
                            label={flavor}
                            variant={searchNoteSet.has(String(flavor).toLowerCase()) ? 'gold' : 'default'}
                          />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noFlavors}>Not enough published notes yet</Text>
                    )}
                  </View>
                  <PalateFitNote
                    match={item.match}
                    confidence={palate?.confidence}
                    compact
                    hideIfWeak
                    label="Vs your journal"
                  />
                </View>
              )}
            />
          );
        }) : null}
      </TasteSearchResultsSheet>
      <ScreenContainer scroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Taste Search</Text>
        <Text style={styles.subtitle}>
          Find cigars that fit what you like, or look up a cigar to see how it matches your palate.
        </Text>

        <SegmentedControl
          options={MODES}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setHasSearched(false);
            setResults([]);
            setAppliedSearch(null);
            setSearchLimitReached(false);
            setSignInRequired(false);
            setResultsSheetVisible(false);
          }}
        />

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            value={query}
            onChangeText={setQuery}
            autoCapitalize={mode === 'cigar' ? 'words' : 'none'}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {mode === 'taste' ? (
          <>
            {palate?.hasPalate ? (
              <Pressable style={styles.palateBtn} onPress={applyMyPalate}>
                <MaterialCommunityIcons name="star-four-points" size={16} color={colors.gold} />
                <Text style={styles.palateBtnText}>Use my palate</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                Journal a few smokes to search from your own taste profile.
              </Text>
            )}
            <Text style={styles.chipLabel}>Flavor notes</Text>
            <FlavorChips
              selected={selectedFlavors}
              onToggle={toggleFlavor}
              extras={palateFlavorChips(palate?.profile)}
            />
          </>
        ) : (
          <Text style={styles.hint}>
            Search a brand or cigar to see typical flavors and whether it correlates with what you already enjoy.
          </Text>
        )}

        <CavaroButton
          label={mode === 'cigar' ? 'Look up cigar' : 'Find cigars'}
          icon="magnify"
          onPress={runSearch}
          loading={loading}
          disabled={loading}
          style={styles.searchBtn}
        />

        {tier === 'free' ? (
          <Text style={styles.limitHint}>Free includes 3 searches per day.</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.gold} style={styles.spinner} />
        ) : null}

        {searchLimitReached ? (
          <View style={styles.limitBlock}>
            <Text style={styles.limitTitle}>Daily search limit reached</Text>
            <Text style={styles.limitText}>
              Free includes 3 taste searches a day. Subscribe for unlimited search and AI tasting notes.
            </Text>
            <CavaroButton
              label="Subscribe for $2.99/mo"
              icon="crown"
              onPress={() =>
                showUpgrade('Subscribe to Premium for $2.99/mo for unlimited taste search.')
              }
            />
          </View>
        ) : null}

        {signInRequired ? (
          <Text style={styles.hint}>Sign in to search the catalog and community tasting notes.</Text>
        ) : null}

        {hasSearched && !loading && !searchLimitReached && !signInRequired && results.length > 0 && !resultsSheetVisible ? (
          <Pressable
            style={styles.viewResultsBtn}
            onPress={() => setResultsSheetVisible(true)}
          >
            <MaterialCommunityIcons name="cigar" size={18} color={colors.gold} />
            <Text style={styles.viewResultsText}>
              {resultsHeading(results.length, appliedSearch)}
            </Text>
            <MaterialCommunityIcons name="chevron-up" size={20} color={colors.gold} />
          </Pressable>
        ) : null}
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
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  palateBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  palateBtnText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  chipLabel: {
    ...typography.label,
    color: colors.goldMuted,
    marginBottom: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.surfaceWarm,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.gold,
    fontWeight: '600',
  },
  searchBtn: {
    marginBottom: spacing.sm,
  },
  limitHint: {
    ...typography.caption,
    color: colors.textSubtle,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  viewResultsText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
    flex: 1,
  },
  limitBlock: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  limitTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  limitText: {
    ...typography.body,
    color: colors.textMuted,
  },
  resultFooter: {
    gap: spacing.md,
  },
  footerLabel: {
    ...typography.label,
    color: colors.goldMuted,
    marginBottom: spacing.xs,
  },
  whyHere: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  resultFlavors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  noFlavors: {
    ...typography.caption,
    color: colors.textSubtle,
  },
});
