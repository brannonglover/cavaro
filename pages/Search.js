import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { searchReviewsByTaste, getTopReviewedCigars } from '../api/reviews';
import { fetchCatalog } from '../api/catalog';
import { subscribeOrManage, restoreSubscription } from '../api/subscription';
import { openManageSubscriptions } from '../lib/iap';
import { db } from '../db';
import { COMMON_FLAVORS } from '../components/StrengthProfileModal';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import colors from '../theme/colors';
import SubscriptionLegalLinks from '../components/SubscriptionLegalLinks';
import RestoreSubscriptionResultModal, {
  getRestoreSubscriptionAlert,
  getSubscribeFailureAlert,
} from '../components/RestoreSubscriptionResultModal';

function filterCatalogByTaste(catalog, keywords) {
  if (!keywords?.length || !catalog?.length) return [];
  const terms = keywords.map((k) => k.toLowerCase());
  return catalog.filter((c) => {
    const searchable = [
      c.description ?? '',
      c.wrapper ?? '',
      c.binder ?? '',
      c.filler ?? '',
    ].join(' ').toLowerCase();
    return terms.some((t) => searchable.includes(t));
  });
}

function SearchCigarCard({ cigar, expanded, onToggleExpand, onAddToCavaro, showRating }) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggleExpand}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{cigar.name ?? 'Unknown'}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.cardBrand}>
              {[cigar.brand, cigar.line].filter(Boolean).join(' · ') || '—'}
            </Text>
              <Text style={styles.cardSize}>Size: {cigar.length ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            {cigar.image ? (
              <Image source={{ uri: cigar.image }} style={styles.thumbnail} />
            ) : null}
            {showRating && cigar.avg_rating != null && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  ★ {cigar.avg_rating}
                  {cigar.review_count != null ? ` (${cigar.review_count})` : ''}
                </Text>
              </View>
            )}
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.textSecondary}
              style={styles.chevron}
            />
          </View>
        </View>
        {!expanded && cigar.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{cigar.description}</Text>
        ) : null}
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          {cigar.description ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailText}>{cigar.description}</Text>
            </View>
          ) : null}
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Blend</Text>
            <Text style={styles.detailText}>
              Wrapper: {cigar.wrapper ?? '—'}{'\n'}
              Binder: {cigar.binder ?? '—'}{'\n'}
              Filler: {cigar.filler ?? '—'}
            </Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => onAddToCavaro(cigar)}
          >
            <MaterialCommunityIcons name="plus" size={20} color={colors.screenBg} />
            <Text style={styles.addBtnText}>Add to Cavaro</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Search({ navigation }) {
  const { tier, supabase, refreshTier } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [topCigars, setTopCigars] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [searchLimitReached, setSearchLimitReached] = useState(false);
  const [searchSignInRequired, setSearchSignInRequired] = useState(false);
  const [restoreAlert, setRestoreAlert] = useState(null);

  const runSearch = useCallback(async () => {
    const keywords = [
      ...selectedFlavors,
      ...(query.trim() ? query.trim().toLowerCase().split(/\s+/) : []),
    ].filter(Boolean);
    setSearchLimitReached(false);
    setSearchSignInRequired(false);
    if (keywords.length > 0) {
      setSearchLoading(true);
      try {
        const token = (await supabase?.auth.getSession())?.data?.session?.access_token ?? null;
        let rows = await searchReviewsByTaste(keywords, token);
        if (!rows?.length && catalog?.length > 0) {
          rows = filterCatalogByTaste(catalog, keywords);
        }
        setSearchResults(rows ?? []);
        trackEvent('search_performed', { keyword_count: keywords.length, has_results: !!(rows?.length) });
      } catch (err) {
        if (err.code === 'SEARCH_LIMIT_EXCEEDED') {
          setSearchLimitReached(true);
          setSearchResults([]);
        } else if (err.code === 'SIGN_IN_REQUIRED') {
          setSearchSignInRequired(true);
          setSearchResults([]);
        } else {
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  }, [query, selectedFlavors, catalog, supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await supabase?.auth.getSession())?.data?.session?.access_token ?? null;
      const canSeeTop = tier === 'premium' && token;
      const [top, cat] = await Promise.all([
        canSeeTop ? getTopReviewedCigars(5, token) : Promise.resolve([]),
        fetchCatalog().catch(() => db.getAllAsync('SELECT * FROM cigar_catalog ORDER BY brand, name, length')),
      ]);
      setTopCigars(top ?? []);
      setCatalog(cat ?? []);
    } catch (err) {
      console.error('Search load error:', err);
      setTopCigars([]);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [tier, supabase]);

  useFocusEffect(
    useCallback(() => {
      refreshTier?.();
      loadData();
    }, [loadData, refreshTier])
  );

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const handleUpgradePress = async () => {
    if (!supabase) {
      Alert.alert('Not configured', 'Supabase auth is not set up.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to upgrade to premium.');
      return;
    }
    try {
      const result = await subscribeOrManage(session.access_token, tier, session.user.id);
      if (result?.alreadySubscribed) {
        Alert.alert(
          "You're already subscribed",
          'Open subscription management to change or cancel.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Manage', onPress: () => openManageSubscriptions().then(() => refreshTier?.()) },
          ]
        );
        return;
      }
      if (result?.alreadyOwned) {
        refreshTier?.();
        const alert = getRestoreSubscriptionAlert(result.restoreResult);
        if (alert) setRestoreAlert(alert);
        return;
      }
      if (result?.unavailable) {
        Alert.alert('Premium', result.message || 'Not available on this device.');
        return;
      }
      if (result?.started && result.outcomePromise) {
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
      Alert.alert('Error', err.message || 'Could not start subscription');
    }
  };

  const handleRestorePress = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      Alert.alert('Sign in required', 'Please sign in to restore your subscription.');
      return;
    }
    const result = await restoreSubscription(session.access_token);
    refreshTier?.();
    const alert = getRestoreSubscriptionAlert(result);
    if (alert) setRestoreAlert(alert);
  };

  const toggleFlavor = (flavor) => {
    setSelectedFlavors((prev) =>
      prev.includes(flavor) ? prev.filter((f) => f !== flavor) : [...prev, flavor]
    );
  };

  const hasSearch = query.trim() || selectedFlavors.length > 0;
  const hasResults = searchResults.length > 0;

  const [expandedCardKey, setExpandedCardKey] = useState(null);
  const [topSectionExpanded, setTopSectionExpanded] = useState(false);

  const handleAddToCavaro = (cigar) => {
    trackEvent('add_from_search', { brand: cigar.brand, name: cigar.name });
    navigation.navigate('Cavaro', {
      screen: 'AddCigar',
      params: { prefillBrand: cigar.brand, prefillName: cigar.name, prefillLength: cigar.length },
    });
  };

  const getCardKey = (c) => `top-${c.id}`;
  const getSearchCardKey = (c) => `search-${c.id}-${c.brand}-${c.name}-${c.length}`;

  return (
    <>
      <RestoreSubscriptionResultModal
        alert={restoreAlert}
        onClose={() => setRestoreAlert(null)}
      />
      <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find cigars by taste profile</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar} collapsable={false}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search flavors: earthy, woody, cocoa..."
            placeholderTextColor={colors.placeholderText}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {(query || selectedFlavors.length > 0) && (
            <Pressable
              onPress={() => {
                setQuery('');
                setSelectedFlavors([]);
              }}
              hitSlop={12}
            >
              <MaterialCommunityIcons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <Text style={styles.chipLabel}>Quick filters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {COMMON_FLAVORS.map((f) => {
            const selected = selectedFlavors.includes(f);
            return (
              <Pressable
                key={f}
                onPress={() => toggleFlavor(f)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {tier === 'premium' && topCigars.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.topSectionHeader}
                onPress={() => setTopSectionExpanded((prev) => !prev)}
              >
                <View>
                  <Text style={styles.sectionTitle}>Top 5 from community reviews</Text>
                  <Text style={styles.topSectionSubtitle}>
                    Tap to view highest-rated cigars
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={topSectionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={28}
                  color={colors.textSecondary}
                />
              </Pressable>
              {topSectionExpanded && (
                topCigars.map((c) => (
                  <SearchCigarCard
                    key={c.id}
                    cigar={c}
                    showRating
                    expanded={expandedCardKey === getCardKey(c)}
                    onToggleExpand={() =>
                      setExpandedCardKey((prev) =>
                        prev === getCardKey(c) ? null : getCardKey(c)
                      )
                    }
                    onAddToCavaro={handleAddToCavaro}
                  />
                ))
              )}
            </View>
          )}

          {tier === 'free' && (
            <View style={styles.section}>
              <View style={styles.topSectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Top 5 from community reviews</Text>
                  <Text style={styles.topSectionSubtitle}>
                    Subscribe to Premium for $2.99/mo to see highest-rated cigars
                  </Text>
                </View>
                <MaterialCommunityIcons name="lock" size={24} color={colors.textMuted} />
              </View>
              <Pressable style={styles.upgradeCard} onPress={handleUpgradePress}>
                <Text style={styles.upgradeCardText}>Subscribe for $2.99/mo to see top cigars</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.restoreLink} onPress={handleRestorePress}>
                <Text style={styles.restoreLinkText}>Already have a subscription? Restore it</Text>
              </Pressable>
              <SubscriptionLegalLinks compact style={styles.subscriptionLegalInline} />
            </View>
          )}

          {hasSearch && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search results</Text>
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />
              ) : searchLimitReached ? (
                <View style={styles.limitReachedWrap}>
                  <Text style={styles.limitReachedText}>
                    Free users get 3 searches per day. Subscribe for $2.99/mo for unlimited searches.
                  </Text>
                  <Pressable style={styles.upgradeBtn} onPress={handleUpgradePress}>
                    <Text style={styles.upgradeBtnText}>Subscribe for $2.99/mo</Text>
                  </Pressable>
                  <Pressable style={styles.restoreLink} onPress={handleRestorePress}>
                    <Text style={styles.restoreLinkText}>Restore subscription</Text>
                  </Pressable>
                  <SubscriptionLegalLinks compact style={styles.subscriptionLegalInline} />
                </View>
              ) : searchSignInRequired ? (
                <Text style={styles.emptyText}>Sign in to search community reviews.</Text>
              ) : !hasResults ? (
                <Text style={styles.emptyText}>No cigars match that taste profile in community reviews.</Text>
              ) : (
                searchResults.map((c) => (
                  <SearchCigarCard
                    key={getSearchCardKey(c)}
                    cigar={c}
                    expanded={expandedCardKey === getSearchCardKey(c)}
                    onToggleExpand={() =>
                      setExpandedCardKey((prev) =>
                        prev === getSearchCardKey(c) ? null : getSearchCardKey(c)
                      )
                    }
                    onAddToCavaro={handleAddToCavaro}
                  />
                ))
              )}
            </View>
          )}

          {!hasSearch && tier === 'premium' && topCigars.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="cigar" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>
                Community reviews will appear here once users start rating cigars.
              </Text>
              <Text style={styles.emptyStateHint}>
                Use the search bar or flavor chips to find cigars by taste from shared reviews.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
      </SafeAreaView>
    </View>
    </>
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
  header: {
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
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  chipLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.screenBg,
    fontWeight: '600',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  topSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 8,
  },
  topSectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cardBrand: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardSize: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chevron: {
    marginTop: 4,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  detailBlock: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.screenBg,
  },
  ratingBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.screenBg,
  },
  searchSpinner: {
    marginVertical: 16,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyStateHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  subscriptionLegalInline: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 0,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  upgradeCardText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  limitReachedWrap: {
    paddingVertical: 16,
  },
  limitReachedText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  upgradeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  upgradeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.screenBg,
  },
  restoreLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreLinkText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
});
