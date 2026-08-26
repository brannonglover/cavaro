import React, { useState, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, FlatList, Pressable, Image, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { hapticMedium, hapticSuccess, hapticWarning } from '../lib/haptics';
import { db, COLLECTIONS, ARCHIVE_WHERE, markCigarSmokedWithJournal } from '../db';
import colors from '../theme/colors';
import { colors as designColors } from '../theme';
import ImageViewerModal from './ImageViewerModal';
import AddToFavoritesModal from './AddToFavoritesModal';
import PersonalNotesModal from './PersonalNotesModal';
import MarkSmokedReviewModal from './MarkSmokedReviewModal';
import StrengthProfileModal from './StrengthProfileModal';
import ConfirmModal from './ConfirmModal';
import UpgradeToPremiumModal from './UpgradeToPremiumModal';
import MoveCigarModal from './MoveCigarModal';
import StartCellaringModal from './StartCellaringModal';
import HumidorInventoryCard from './humidors/HumidorInventoryCard';
import StrengthIndicator, { getOverallStrength } from './StrengthIndicator';
import { EmptyState } from './ui';
import { parseStrengthProfile } from './StrengthProfileModal';
import { useAuth } from '../context/AuthContext';
import { restoreSubscription } from '../api/subscription';
import { trackEvent } from '../lib/analytics';
import { schedulePushUserCigars } from '../lib/userCigarsSync';

function hasSmokeNotes(cigar) {
  const s = (cigar?.smoke_notes ?? '').trim();
  if (!s) return false;
  try {
    const o = JSON.parse(s);
    return !!(o.draw || o.burn_line || o.ash_quality || o.smoke_output || o.relights_needed);
  } catch {
    return false;
  }
}

function ExpandableFavoriteNotes({ isExpanded, cigar, onEdit, onOpenStrengthProfile }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(-16)).current;

  const hasStrengthProfile = !!(cigar.strength_profile ?? '').trim();
  const { thirds: strengthThirds } = parseStrengthProfile(cigar.strength_profile ?? '');
  const smokeNotes = (() => {
    try {
      const s = (cigar.smoke_notes ?? '').trim();
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })();
  const hasNotes =
    (smokeNotes && (smokeNotes.draw || smokeNotes.burn_line || smokeNotes.ash_quality || smokeNotes.smoke_output || smokeNotes.relights_needed)) ||
    hasStrengthProfile;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(maxHeight, {
        toValue: isExpanded ? 480 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(marginTop, {
        toValue: isExpanded ? 12 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(marginBottom, {
        toValue: isExpanded ? 0 : -16,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded, opacity, maxHeight, marginTop, marginBottom]);

  const allBlocks = [
    smokeNotes?.draw && { label: 'Draw', text: smokeNotes.draw },
    smokeNotes?.burn_line && { label: 'Burn line', text: smokeNotes.burn_line },
    smokeNotes?.ash_quality && { label: 'Ash quality', text: smokeNotes.ash_quality },
    smokeNotes?.smoke_output && { label: 'Smoke output', text: smokeNotes.smoke_output },
    smokeNotes?.relights_needed && { label: 'Relights needed', text: smokeNotes.relights_needed },
  ].filter(Boolean);

  const strengthProfileBlock = hasStrengthProfile && (
    <View key="strength-profile" style={styles.notesBlock}>
      <View style={styles.strengthProfileHeader}>
        <Text style={styles.notesLabel}>Strength profile</Text>
        {onOpenStrengthProfile && (
          <Pressable onPress={() => onOpenStrengthProfile(cigar)} hitSlop={8} style={styles.editStrengthBtn}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
            <Text style={styles.editStrengthText}>Edit</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.strengthThirdsRow}>
        {['First', 'Second', 'Final'].map((label, i) => {
          const t = strengthThirds[i] ?? { strength: 0, flavors: [] };
          return (
            <View key={i} style={styles.strengthThirdCol}>
              <Text style={styles.strengthThirdLabel}>{label}</Text>
              <View style={styles.strengthDotsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <View
                    key={n}
                    style={[
                      styles.strengthDotSmall,
                      n <= (t.strength ?? 0) ? styles.strengthDotFilled : styles.strengthDotEmpty,
                    ]}
                  />
                ))}
              </View>
              {(t.flavors ?? []).length > 0 && (
                <Text style={styles.strengthFlavorsText} numberOfLines={2}>
                  {(t.flavors ?? []).join(', ')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  const firstRowContent = !hasNotes ? (
    <Text style={styles.notesEmpty}>No notes yet.</Text>
  ) : allBlocks.length > 0 ? (
    <View style={styles.notesBlock}>
      <Text style={styles.notesLabel}>{allBlocks[0].label}</Text>
      <Text style={styles.notesText}>{allBlocks[0].text}</Text>
    </View>
  ) : (
    strengthProfileBlock
  );

  const remainingBlocks = [
    ...allBlocks.slice(1).map((block) => (
      <View key={block.label} style={styles.notesBlock}>
        <Text style={styles.notesLabel}>{block.label}</Text>
        <Text style={styles.notesText}>{block.text}</Text>
      </View>
    )),
    ...(allBlocks.length > 0 ? [strengthProfileBlock] : []),
  ].filter(Boolean);

  return (
    <Animated.View style={[
      styles.notesSection,
      { opacity, maxHeight, marginTop, marginBottom, overflow: 'hidden', minHeight: 0 },
    ]}>
      {onEdit ? (
        <View style={styles.notesFirstRow}>
          <View style={styles.notesFirstRowContent}>{firstRowContent}</View>
          <Pressable onPress={onEdit} hitSlop={8} style={styles.editNotesIconBtn}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>
      ) : (
        firstRowContent
      )}
      {remainingBlocks}
    </Animated.View>
  );
}

function ExpandableDetails({ isExpanded, cigar, variant = 'default' }) {
  const isInventory = variant === 'inventory';
  const [smokeHistory, setSmokeHistory] = useState([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(isInventory ? 0 : -16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isExpanded ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(maxHeight, {
        toValue: isExpanded ? 500 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(marginTop, {
        toValue: isExpanded ? (isInventory ? 0 : 16) : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(marginBottom, {
        toValue: isExpanded ? 0 : (isInventory ? 0 : -16),
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded, isInventory, opacity, maxHeight, marginTop, marginBottom]);

  useEffect(() => {
    if (!isExpanded || !cigar?.id) return;
    let cancelled = false;
    db.getAllAsync('SELECT smoked_at FROM smoke_history WHERE cigar_id = ? ORDER BY smoked_at DESC', cigar.id)
      .then((rows) => {
        if (!cancelled) setSmokeHistory(rows || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isExpanded, cigar?.id]);

  const addedDateFormatted = formatDateStringLocal(cigar.date_added?.trim() ?? '');

  const smokeHistoryFormatted = smokeHistory.map((r) => formatDateStringLocal(r.smoked_at) ?? r.smoked_at);
  const lastSmokedDisplay = smokeHistoryFormatted.length > 0
    ? smokeHistoryFormatted.join(', ')
    : formatLastSmoked(cigar);

  return (
    <Animated.View style={[
      isInventory ? styles.inventoryAttributesShow : styles.attributesShow,
      {
        opacity,
        maxHeight,
        marginTop,
        marginBottom,
        overflow: 'hidden',
        minHeight: 0,
      }
    ]}>
      <View style={isInventory ? styles.inventoryDetailsBody : undefined}>
        <View>
          <Text style={styles.cigarText}>{cigar.description ?? ''}</Text>
        </View>
        <View style={styles.cigarAttributes}>
          <View style={styles.cigarMake}>
            <Text style={styles.cigarText}>
              <Text style={styles.boldText}>Wrapper:</Text> {cigar.wrapper ?? '—'}
            </Text>
            <Text style={styles.cigarText}>
              <Text style={styles.boldText}>Binder:</Text> {cigar.binder ?? '—'}
            </Text>
            <Text style={styles.cigarText}>
              <Text style={styles.boldText}>Filler:</Text> {cigar.filler ?? '—'}
            </Text>
            {addedDateFormatted && (
              <Text style={styles.cigarText}>
                <Text style={styles.boldText}>Added:</Text> {addedDateFormatted}
                {formatAgingDuration(cigar.date_added) ? ` (aged ${formatAgingDuration(cigar.date_added)})` : ''}
              </Text>
            )}
            {lastSmokedDisplay && (
              <Text style={styles.cigarText}>
                <Text style={styles.boldText}>Last Smoked:</Text> {lastSmokedDisplay}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function AnimatedStackChevron({ expanded }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation]);
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
    </Animated.View>
  );
}

function groupByBrand(cigars) {
  const groups = {};
  for (const c of cigars) {
    const brand = c.brand || 'Unknown';
    if (!groups[brand]) groups[brand] = [];
    groups[brand].push(c);
  }
  return Object.entries(groups).map(([brand, cigars]) => ({ brand, cigars }));
}

/**
 * Formats date_added (YYYY-MM-DD) into a human-readable aging duration.
 * Returns null if date is missing or invalid.
 */
function formatAgingDuration(dateAddedStr) {
  if (!dateAddedStr || !dateAddedStr.trim()) return null;
  const parts = dateAddedStr.trim().slice(0, 10).split('-').map(Number);
  if (parts.length !== 3) return null;
  const added = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(added.getTime())) return null;
  const now = new Date();
  const diffMs = now - added;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 14) return '1 week';
  if (diffDays < 31) return `${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 60) return '1 month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  if (diffDays < 730) return '1 year';
  return `${Math.floor(diffDays / 365)} years`;
}

/** Parses YYYY-MM-DD as local date (new Date(str) treats it as UTC midnight, shifting day in western TZ). */
function formatDateStringLocal(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim().slice(0, 10);
  const parts = s.split('-').map(Number);
  if (parts.length !== 3) return str;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? str : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLastSmoked(cigar) {
  const raw = cigar.last_smoked?.trim() || cigar.smoked_date?.trim();
  if (!raw) return null;
  return formatDateStringLocal(raw) ?? raw;
}

const LONG_PRESS_MS = 500;

const FREE_FAVORITES_LIMIT = 5;

export default function CigarList({
  view,
  onEditCigar,
  inventoryMode = false,
  humidorId = null,
  inventorySegment,
  onInventoryChange,
  emptyActionLabel,
  onEmptyAction,
  listHeader,
  bottomPadding = 0,
}) {
  const { user, tier, supabase, refreshTier } = useAuth();
  const [show, setShow] = useState(false);
  const [cigarNum, setCigarNum] = useState(0);
  const [viewList, setViewList] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);
  const [expandedStacks, setExpandedStacks] = useState({});
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [addToFavoritesModalCigar, setAddToFavoritesModalCigar] = useState(null);
  const [personalNotesModalCigar, setPersonalNotesModalCigar] = useState(null);
  const [smokedOneModalCigar, setSmokedOneModalCigar] = useState(null);
  const [moveCigarModalCigar, setMoveCigarModalCigar] = useState(null);
  const [cellaringModalCigar, setCellaringModalCigar] = useState(null);
  const [strengthProfileModalCigar, setStrengthProfileModalCigar] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', buttons: [] });
  const [upgradeModal, setUpgradeModal] = useState({ visible: false, message: '', accessToken: null, userId: null });
  const flatListRef = React.useRef(null);

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, visible: false }));

  const isFavoritesWithStacks = view === COLLECTIONS.LIKES;
  const displayData = isFavoritesWithStacks ? groupByBrand(viewList) : viewList;

  const showUpgradePrompt = (message = 'Subscribe to Premium for $2.99/mo to unlock this feature.') => {
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

  const toggleDetails = (num) => {
    if (show) {
      setShow(false)
      setCigarNum(num)
    } else {
      setShow(true)
      setCigarNum(num)
    }
  }

  const cigarQuery = (whereClause) =>
    `SELECT cigars.*,
      (SELECT smoked_at FROM smoke_history WHERE cigar_id = cigars.id ORDER BY smoked_at DESC LIMIT 1) as last_smoked
    FROM cigars
    WHERE ${whereClause}`;

  const loadCigarsForView = async (viewName) => {
    if (viewName === COLLECTIONS.LIKES) {
      return db.getAllAsync(
        cigarQuery('collection = ? OR (collection = ? AND is_favorite = 1)'),
        COLLECTIONS.LIKES,
        COLLECTIONS.CAVARO
      );
    }
    if (viewName === COLLECTIONS.CAVARO) {
      let where = 'collection = ? AND quantity > 0';
      const params = [COLLECTIONS.CAVARO];

      if (inventoryMode) {
        if (humidorId != null) {
          where += ' AND humidor_id = ?';
          params.push(humidorId);
        }
        if (inventorySegment === 'favorites') {
          where += ' AND is_favorite = 1';
        }
        if (inventorySegment === 'cellared') {
          where += ' AND EXISTS (SELECT 1 FROM cellared_items ci WHERE ci.cigar_id = cigars.id)';
        }
      } else if (humidorId != null) {
        where += ' AND humidor_id = ?';
        params.push(humidorId);
      }

      let query = cigarQuery(where);
      if (inventoryMode && inventorySegment === 'recent') {
        query += ' ORDER BY COALESCE(cigars.date_added, cigars.id) DESC';
      }

      return db.getAllAsync(query, ...params);
    }
    if (viewName === COLLECTIONS.ARCHIVE) {
      return db.getAllAsync(cigarQuery(ARCHIVE_WHERE));
    }
    return db.getAllAsync(cigarQuery('collection = ?'), viewName);
  };

  const refreshList = async () => {
    try {
      const rows = await loadCigarsForView(view);
      setViewList(rows);
      if (user && supabase) {
        schedulePushUserCigars(supabase);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onDislike = async (id) => {
    try {
      trackEvent('cigar_disliked');
      await db.runAsync(
        'UPDATE cigars SET collection = ?, is_favorite = 0 WHERE id = ?',
        COLLECTIONS.DISLIKES,
        id
      );
      console.log('Cigar moved to Dislikes');
      refreshList();
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  };

  const toggleFavorite = async (cigar, isFavorite) => {
    if (isFavorite) {
      if (view === COLLECTIONS.LIKES) {
        setConfirmModal({
          visible: true,
          title: 'Remove from favorites',
          message: 'You smoked this cigar and unfavorited it. Should it go to Dislikes or be removed from favorites?',
          buttons: [
            { text: 'Cancel', style: 'cancel', onPress: closeConfirmModal },
            {
              text: 'Move to Dislikes',
              onPress: () => {
                closeConfirmModal();
                onDislike(cigar.id);
              },
            },
            {
              text: 'Remove',
              onPress: async () => {
                closeConfirmModal();
                try {
                  trackEvent('cigar_unfavorited');
                  const qty = Math.max(0, (parseInt(cigar.quantity, 10) || 1) - 1);
                  await db.runAsync(
                    'UPDATE cigars SET collection = ?, is_favorite = 0, quantity = ?, smoke_notes = NULL, smoked_date = NULL WHERE id = ?',
                    COLLECTIONS.CAVARO,
                    qty,
                    cigar.id
                  );
                  refreshList();
                } catch (e) {
                  console.log(e);
                }
              },
            },
          ],
        });
      } else {
        trackEvent('cigar_unfavorited');
        db.runAsync(
          'UPDATE cigars SET is_favorite = 0, smoke_notes = NULL, smoked_date = NULL WHERE id = ?',
          cigar.id
        ).then(refreshList).catch((e) => console.log(e));
      }
    } else {
      if (tier === 'free' && supabase) {
        const rows = await db.getAllAsync('SELECT COUNT(*) as n FROM cigars WHERE is_favorite = 1');
        const count = rows?.[0]?.n ?? 0;
        if (count >= FREE_FAVORITES_LIMIT) {
          showUpgradePrompt(`Free tier allows up to ${FREE_FAVORITES_LIMIT} favorites. Subscribe to Premium for unlimited.`);
          return;
        }
      }
      setAddToFavoritesModalCigar(cigar);
    }
  };

  const openPersonalNotes = (cigar) => {
    setPersonalNotesModalCigar(cigar);
  };

  const handleAddToFavorites = async (smokedDate) => {
    if (!addToFavoritesModalCigar) return;
    const cigar = addToFavoritesModalCigar;
    const dateToUse = smokedDate?.trim() || null;
    try {
      const quantity = Math.max(0, parseInt(cigar.quantity, 10) || 1);
      const isFromCavaro = view === COLLECTIONS.CAVARO || view === COLLECTIONS.ARCHIVE;
      const shouldLeaveCavaro = isFromCavaro && quantity < 2;
      if (shouldLeaveCavaro) {
        await db.runAsync(
          `UPDATE cigars SET collection = ?, is_favorite = 1, smoked_date = ? WHERE id = ?`,
          COLLECTIONS.LIKES,
          dateToUse,
          cigar.id
        );
      } else {
        const newQuantity = Math.max(1, quantity - 1);
        await db.runAsync(
          `UPDATE cigars SET is_favorite = 1, quantity = ?, smoked_date = ? WHERE id = ?`,
          newQuantity,
          dateToUse,
          cigar.id
        );
      }
      trackEvent('cigar_favorited');
      hapticSuccess();
      setAddToFavoritesModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error adding to favorites: ${error}`);
    }
  };

  const handlePersonalNotesSave = async (notes) => {
    if (!personalNotesModalCigar) return;
    try {
      await db.runAsync(
        `UPDATE cigars SET smoke_notes = ? WHERE id = ?`,
        notes.smoke_notes || null,
        personalNotesModalCigar.id
      );
      trackEvent('personal_notes_saved');
      setPersonalNotesModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error saving notes: ${error}`);
    }
  };

  const handleMarkSmokedSave = async (review) => {
    if (!smokedOneModalCigar) return;
    try {
      await markCigarSmokedWithJournal({
        cigarId: smokedOneModalCigar.id,
        userId: user?.id,
        entry: review,
      });
      trackEvent('cigar_smoked', {
        rating: review.rating,
        would_buy_again: review.wouldBuyAgain,
      });
      hapticSuccess();
      setSmokedOneModalCigar(null);
      refreshList();
      onInventoryChange?.();
    } catch (error) {
      console.log(`Error marking smoked: ${error}`);
      Alert.alert('Could not save', error.message || 'Please try again.');
    }
  };

  const handleStrengthProfileSave = async (profile) => {
    if (!strengthProfileModalCigar) return;
    try {
      const json = JSON.stringify(profile);
      await db.runAsync(
        'UPDATE cigars SET strength_profile = ? WHERE id = ?',
        json,
        strengthProfileModalCigar.id
      );
      trackEvent('strength_profile_saved');
      setStrengthProfileModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error saving strength profile: ${error}`);
    }
  };

  const removeFromDislikes = async (cigar) => {
    setConfirmModal({
      visible: true,
      title: 'Remove from Dislikes',
      message: 'Remove this cigar from Dislikes?',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: closeConfirmModal },
        {
          text: 'Favorite',
          onPress: async () => {
            closeConfirmModal();
            try {
              await db.runAsync(
                'UPDATE cigars SET collection = ?, is_favorite = 1 WHERE id = ?',
                COLLECTIONS.LIKES,
                cigar.id
              );
              refreshList();
            } catch (e) {
              console.log(e);
            }
          },
        },
        {
          text: 'Remove',
          onPress: async () => {
            closeConfirmModal();
            try {
              const qty = Math.max(0, (parseInt(cigar.quantity, 10) || 1) - 1);
              await db.runAsync(
                'UPDATE cigars SET collection = ?, is_favorite = 0, quantity = ?, smoke_notes = NULL, smoked_date = NULL WHERE id = ?',
                COLLECTIONS.CAVARO,
                qty,
                cigar.id
              );
              refreshList();
            } catch (e) {
              console.log(e);
            }
          },
        },
      ],
    });
  };

  const restoreToCavaro = async (id) => {
    try {
      trackEvent('cigar_restored_from_archive');
      await db.runAsync('UPDATE cigars SET quantity = 1 WHERE id = ?', id);
      refreshList();
    } catch (error) {
      console.log(`Error restoring cigar: ${error}`);
    }
  };

  const deleteCigar = async (id) => {
    try {
      hapticWarning();
      await db.runAsync('DELETE FROM cigars WHERE id = ?', id);
      refreshList();
    } catch (error) {
      console.log(`Error deleting cigar: ${error}`);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setShow(false);
      setExpandedNotes(null);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      let cancelled = false;
      const load = async () => {
        try {
          const rows = await loadCigarsForView(view);
          if (!cancelled) setViewList(rows);
        } catch (error) {
          console.log(error);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [view, humidorId, inventorySegment])
  );

  useEffect(() => {
    refreshList();
  }, [humidorId, inventorySegment]);

  const toggleStack = (brand) => {
    setExpandedStacks((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const longPressTimerRef = useRef(null);

  const handlePressIn = (cigar) => {
    if (!onEditCigar) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      hapticMedium();
      onEditCigar(cigar);
    }, LONG_PRESS_MS);
  };

  const handlePressOut = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const renderRightActions = (cigar) => (progress, dragX, swipeable) => (
    <View style={styles.deleteActionWrapper}>
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          swipeable.close();
          deleteCigar(cigar.id);
        }}
      >
        <MaterialCommunityIcons name="delete-outline" size={24} color="#fff" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
    </View>
  );

  const renderCigarCard = (cigar, index, detailsKey) => {
    if (inventoryMode && view === COLLECTIONS.CAVARO) {
      const isExpanded = show && detailsKey === cigarNum;

      return (
        <View key={cigar.id} style={styles.inventoryItemWrapper}>
          <Swipeable
            renderRightActions={renderRightActions(cigar)}
            friction={2}
            rightThreshold={40}
          >
            <View style={styles.inventoryCardShell}>
              <Pressable
                onPress={() => toggleDetails(detailsKey)}
                onPressIn={() => handlePressIn(cigar)}
                onPressOut={handlePressOut}
              >
                <HumidorInventoryCard
                  cigar={cigar}
                  expanded={isExpanded}
                  embedded
                  onMarkSmoked={() => setSmokedOneModalCigar(cigar)}
                  onMove={() => setMoveCigarModalCigar(cigar)}
                  onStartCellaring={() => setCellaringModalCigar(cigar)}
                  onImagePress={setViewerImage}
                />
              </Pressable>
              <ExpandableDetails
                isExpanded={isExpanded}
                cigar={cigar}
                variant="inventory"
              />
            </View>
          </Swipeable>
        </View>
      );
    }

    return (
    <View key={cigar.id} style={styles.listItemWrapper}>
      <Swipeable
        renderRightActions={renderRightActions(cigar)}
        friction={2}
        rightThreshold={40}
      >
        <Pressable
        onPress={() => toggleDetails(detailsKey)}
        onPressIn={() => handlePressIn(cigar)}
        onPressOut={handlePressOut}
      >
        <View style={styles.cigar}>
          <View style={styles.cigarHeader}>
            <View style={styles.cigarInfo}>
              <Text style={styles.listItem}>{cigar.name ?? 'Unknown'}</Text>
              <View style={styles.subTextWrap}>
                <Text style={styles.subText}>
                  {[cigar.brand, cigar.line].filter(Boolean).join(' · ') || '—'}
                </Text>
                <Text style={styles.subText}>Size: {cigar.length ?? '—'}</Text>
              </View>
            </View>
            <View style={styles.cigarHeaderRight}>
              {view === 'cavaro' && (cigar.quantity ?? 1) > 0 ? (
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityText}>{cigar.quantity ?? 1}</Text>
                </View>
              ) : null}
              {cigar.image ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setViewerImage(cigar.image);
                  }}
                  style={styles.thumbnailWrap}
                >
                  <Image source={{ uri: cigar.image }} style={styles.thumbnail} />
                  <Text style={styles.tapHint}>Tap to view</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <ExpandableDetails
            isExpanded={show && detailsKey === cigarNum}
            cigar={cigar}
          />
          {(view === 'cavaro' || view === 'likes' || view === 'dislikes' || view === 'archive') && !inventoryMode && (
            <ExpandableFavoriteNotes
              isExpanded={expandedNotes === cigar.id}
              cigar={cigar}
              onEdit={() => openPersonalNotes(cigar)}
              onOpenStrengthProfile={(c) => {
                if (tier === 'free' && supabase) {
                  showUpgradePrompt('Strength profile is a Premium feature. Subscribe to add strength and flavor notes for each third.');
                } else {
                  setStrengthProfileModalCigar(c);
                }
              }}
            />
          )}
          {!inventoryMode && (view === 'cavaro' || view === 'likes' || view === 'archive') && (
            <View style={styles.actionIcons}>
              <View style={styles.notesIconBtn}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setExpandedNotes((prev) => (prev === cigar.id ? null : cigar.id));
                  }}
                  hitSlop={8}
                  style={styles.notesIconPressable}
                >
                  <MaterialCommunityIcons
                    name="note-text-outline"
                    size={26}
                    color={
                      hasSmokeNotes(cigar) || !!(cigar.strength_profile ?? '').trim()
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </Pressable>
                <StrengthIndicator
                  strength={getOverallStrength(cigar.strength_profile)}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (tier === 'free' && supabase) {
                      showUpgradePrompt('Strength profile is a Premium feature. Subscribe to add strength and flavor notes for each third.');
                    } else {
                      setStrengthProfileModalCigar(cigar);
                    }
                  }}
                />
              </View>
              <View style={styles.rightActionIcons}>
                {view === 'archive' && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      restoreToCavaro(cigar.id);
                    }}
                    hitSlop={8}
                    style={styles.iconBtn}
                    accessibilityLabel="Restore to Cavaro"
                  >
                    <MaterialCommunityIcons
                      name="archive-arrow-up-outline"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
                {view === 'cavaro' && (cigar.quantity ?? 1) > 0 && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSmokedOneModalCigar(cigar);
                    }}
                    hitSlop={8}
                    style={styles.iconBtn}
                    accessibilityLabel="Mark one as smoked"
                  >
                    <MaterialCommunityIcons
                      name="fire"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleFavorite(cigar, cigar.is_favorite ?? 0);
                  }}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <MaterialCommunityIcons
                    name={(cigar.is_favorite ?? 0) ? 'heart' : 'heart-outline'}
                    size={24}
                    color={(cigar.is_favorite ?? 0) ? colors.primary : colors.textSecondary}
                  />
                </Pressable>
                {(view === 'cavaro' || view === 'archive') && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onDislike(cigar.id);
                    }}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <MaterialCommunityIcons
                      name="cigar-off"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          )}
          {view === 'dislikes' && (
            <View style={styles.actionIcons}>
              <View style={styles.notesIconBtn}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setExpandedNotes((prev) => (prev === cigar.id ? null : cigar.id));
                  }}
                  hitSlop={8}
                  style={styles.notesIconPressable}
                >
                  <MaterialCommunityIcons
                    name="note-text-outline"
                    size={26}
                    color={
                      hasSmokeNotes(cigar) || !!(cigar.strength_profile ?? '').trim()
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </Pressable>
                <StrengthIndicator
                  strength={getOverallStrength(cigar.strength_profile)}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (tier === 'free' && supabase) {
                      showUpgradePrompt('Strength profile is a Premium feature. Subscribe to add strength and flavor notes for each third.');
                    } else {
                      setStrengthProfileModalCigar(cigar);
                    }
                  }}
                />
              </View>
              <View style={styles.rightActionIcons}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    removeFromDislikes(cigar);
                  }}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <MaterialCommunityIcons
                    name="cigar-off"
                    size={24}
                    color={colors.dislike}
                  />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Pressable>
      </Swipeable>
    </View>
    );
  };

  const renderItem = (item) => {
    if (isFavoritesWithStacks) {
      const { brand, cigars } = item;
      const isStack = cigars.length > 1;
      const isExpanded = expandedStacks[brand];

      if (isStack && !isExpanded) {
        return (
          <Pressable
            style={styles.stackCard}
            onPress={() => toggleStack(brand)}
          >
            <View style={styles.stackContent}>
              <Text style={styles.stackBrand}>{brand}</Text>
              <Text style={styles.stackCount}>{cigars.length} cigars</Text>
            </View>
            <AnimatedStackChevron expanded={false} />
          </Pressable>
        );
      }

      if (isStack && isExpanded) {
        return (
          <View style={styles.stackGroup}>
            <Pressable
              style={[styles.stackCard, styles.stackCardExpanded]}
              onPress={() => toggleStack(brand)}
            >
              <View style={styles.stackContent}>
                <Text style={styles.stackBrand}>{brand}</Text>
                <Text style={styles.stackCount}>{cigars.length} cigars</Text>
              </View>
              <AnimatedStackChevron expanded={true} />
            </Pressable>
            <View style={styles.stackGroupItems}>
              {cigars.map((cigar, i) => renderCigarCard(cigar, i, cigar.id))}
            </View>
          </View>
        );
      }

      return renderCigarCard(cigars[0], 0, cigars[0].id);
    }

    const cigar = item;
    return renderCigarCard(cigar, 0, cigar.id);
  };

  const renderEmptyComponent = () => {
    if (view === COLLECTIONS.CAVARO && inventoryMode) {
      return (
        <EmptyState
          compact
          icon="archive-outline"
          title="Your humidor is waiting"
          message="Add your first cigar and start building your inventory."
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      );
    }
    if (view === COLLECTIONS.CAVARO) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Cavaro without cigars is just a fancy box. Time to fill it up.
          </Text>
        </View>
      );
    }
    if (view === COLLECTIONS.ARCHIVE) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Nothing here yet. Cigars you smoke will appear here until you add your thoughts or sort them into Favorites or Dislikes.
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <>
      {view !== '' && (
        <FlatList
          ref={flatListRef}
          style={styles.listItems}
          contentContainerStyle={[
            displayData.length === 0 && styles.emptyListContent,
            bottomPadding > 0 && { paddingBottom: bottomPadding },
          ]}
          data={displayData}
          keyExtractor={(item) =>
            isFavoritesWithStacks ? item.brand : String(item?.id ?? '')
          }
          renderItem={({ item }) => (
            <View style={isFavoritesWithStacks ? styles.stackItemWrapper : undefined}>
              {renderItem(item)}
            </View>
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
      <ImageViewerModal
        visible={!!viewerImage}
        imageUri={viewerImage}
        onClose={() => setViewerImage(null)}
      />
      <AddToFavoritesModal
        visible={!!addToFavoritesModalCigar}
        cigar={addToFavoritesModalCigar}
        onAdd={handleAddToFavorites}
        onCancel={() => setAddToFavoritesModalCigar(null)}
      />
      <PersonalNotesModal
        visible={!!personalNotesModalCigar}
        cigar={personalNotesModalCigar}
        initialNotes={personalNotesModalCigar ? {
          smoke_notes: personalNotesModalCigar.smoke_notes,
        } : {}}
        onSave={handlePersonalNotesSave}
        onCancel={() => setPersonalNotesModalCigar(null)}
      />
      <MarkSmokedReviewModal
        visible={!!smokedOneModalCigar}
        cigar={smokedOneModalCigar}
        onSave={handleMarkSmokedSave}
        onCancel={() => setSmokedOneModalCigar(null)}
      />
      <MoveCigarModal
        visible={!!moveCigarModalCigar}
        cigar={moveCigarModalCigar}
        currentHumidorId={moveCigarModalCigar?.humidor_id ?? humidorId}
        onMoved={() => {
          setMoveCigarModalCigar(null);
          refreshList();
          onInventoryChange?.();
        }}
        onCancel={() => setMoveCigarModalCigar(null)}
      />
      <StartCellaringModal
        visible={!!cellaringModalCigar}
        cigar={cellaringModalCigar}
        humidorId={cellaringModalCigar?.humidor_id ?? humidorId}
        onSaved={() => {
          setCellaringModalCigar(null);
          refreshList();
          onInventoryChange?.();
        }}
        onCancel={() => setCellaringModalCigar(null)}
      />
      <StrengthProfileModal
        visible={!!strengthProfileModalCigar}
        cigar={strengthProfileModalCigar}
        initialProfile={strengthProfileModalCigar?.strength_profile}
        onSave={handleStrengthProfileSave}
        onCancel={() => setStrengthProfileModalCigar(null)}
      />
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        buttons={confirmModal.buttons}
        onClose={closeConfirmModal}
        variant="warning"
      />
      <UpgradeToPremiumModal
        visible={upgradeModal.visible}
        message={upgradeModal.message}
        onClose={() => setUpgradeModal((p) => ({ ...p, visible: false }))}
        accessToken={upgradeModal.accessToken}
        userId={upgradeModal.userId}
        tier={tier}
        refreshTier={refreshTier}
      />
    </>
  );
}

const styles = StyleSheet.create({
  deleteActionWrapper: {
    width: 88,
    marginRight: 16,
    alignSelf: 'stretch',
  },
  deleteAction: {
    flex: 1,
    backgroundColor: colors.dislike,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  listItemWrapper: {
    marginBottom: 12,
  },
  inventoryItemWrapper: {
    marginBottom: 12,
  },
  inventoryCardShell: {
    marginHorizontal: 16,
    backgroundColor: designColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: designColors.border,
    overflow: 'hidden',
  },
  cigar: {
    padding: 18,
    paddingBottom: 36,
    position: 'relative',
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  listItems: {
    flex: 1,
    paddingTop: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    minHeight: 200,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cigarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cigarInfo: {
    flex: 1,
  },
  cigarHeaderRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  actionIcons: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  notesIconPressable: {
    padding: 4,
    marginRight: 4,
  },
  rightActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  quantityBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  quantityText: {
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: '600',
  },
  listItem: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subTextWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  subText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  thumbnailWrap: {
    marginLeft: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  tapHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  attributesShow: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  inventoryAttributesShow: {
    paddingHorizontal: 16,
  },
  inventoryDetailsBody: {
    paddingBottom: 16,
  },
  cigarAttributes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cigarMake: {
    flex: 1,
  },
  cigarText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notesSection: {
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  notesBlock: {
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  notesEmpty: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 8,
  },
  notesFirstRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  notesFirstRowContent: {
    flex: 1,
    marginRight: 8,
  },
  editNotesIconBtn: {
    padding: 4,
  },
  strengthProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editStrengthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  editStrengthText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  strengthThirdsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  strengthThirdCol: {
    flex: 1,
  },
  strengthThirdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  strengthDotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  strengthDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  strengthDotFilled: {
    backgroundColor: colors.primary,
  },
  strengthDotEmpty: {
    backgroundColor: colors.textMuted,
    opacity: 0.4,
  },
  strengthFlavorsText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  stackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stackCardExpanded: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  stackContent: {
    flex: 1,
  },
  stackBrand: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stackCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  stackGroup: {
    marginBottom: 12,
  },
  stackGroupItems: {
    paddingTop: 12,
  },
  stackItemWrapper: {
    marginBottom: 0,
  },
});
