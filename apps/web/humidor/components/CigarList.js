import React, { useState, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, FlatList, Pressable, Image, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, COLLECTIONS } from '../db';
import colors from '../theme/colors';
import ImageViewerModal from './ImageViewerModal';
import FavoriteNotesModal from './FavoriteNotesModal';
import SmokedOneModal from './SmokedOneModal';
import StrengthProfileModal from './StrengthProfileModal';
import StrengthIndicator, { getOverallStrength } from './StrengthIndicator';
import { parseStrengthProfile } from './StrengthProfileModal';

function ExpandableFavoriteNotes({ isExpanded, cigar, onEdit, onOpenStrengthProfile }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(-16)).current;

  const hasStrengthProfile = !!(cigar.strength_profile ?? '').trim();
  const { thirds: strengthThirds } = parseStrengthProfile(cigar.strength_profile ?? '');
  const hasNotes =
    (cigar.favorite_notes ?? '').trim() ||
    (cigar.flavor_profile ?? '').trim() ||
    (cigar.construction_quality ?? '').trim() ||
    (cigar.smoked_date ?? '').trim() ||
    (cigar.flavor_changes ?? '').trim() ||
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
    cigar.favorite_notes && { label: 'Why you liked it', text: cigar.favorite_notes },
    cigar.flavor_profile && { label: 'Flavor profile', text: cigar.flavor_profile },
    cigar.construction_quality && { label: 'Construction', text: cigar.construction_quality },
    cigar.smoked_date && { label: 'When smoked', text: cigar.smoked_date },
    cigar.flavor_changes && { label: 'Flavor changes', text: cigar.flavor_changes },
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

function ExpandableDetails({ isExpanded, cigar }) {
  const [smokeHistory, setSmokeHistory] = useState([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(-16)).current;

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
        toValue: isExpanded ? 16 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(marginBottom, {
        toValue: isExpanded ? 0 : -16,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded, opacity, maxHeight, marginTop, marginBottom]);

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

  const dateAdded = cigar.date_added?.trim();
  const addedDateFormatted = dateAdded
    ? (() => {
        const d = new Date(dateAdded);
        return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      })()
    : null;

  const smokeHistoryFormatted = smokeHistory.map((r) => {
    const d = new Date(r.smoked_at);
    return isNaN(d.getTime()) ? r.smoked_at : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  });

  return (
    <Animated.View style={[
      styles.attributesShow,
      {
        opacity,
        maxHeight,
        marginTop,
        marginBottom,
        overflow: 'hidden',
        minHeight: 0,
      }
    ]}>
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
          {smokeHistoryFormatted.length > 0 && (
            <Text style={styles.cigarText}>
              <Text style={styles.boldText}>Last Smoked:</Text> {smokeHistoryFormatted.join(', ')}
            </Text>
          )}
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
  const added = new Date(dateAddedStr.trim());
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

const LONG_PRESS_MS = 500;

export default function CigarList({ view, onEditCigar }) {
  const [show, setShow] = useState(false);
  const [cigarNum, setCigarNum] = useState(0);
  const [viewList, setViewList] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);
  const [expandedStacks, setExpandedStacks] = useState({});
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [favoriteModalCigar, setFavoriteModalCigar] = useState(null);
  const [favoriteModalMode, setFavoriteModalMode] = useState('add');
  const [smokedOneModalCigar, setSmokedOneModalCigar] = useState(null);
  const [strengthProfileModalCigar, setStrengthProfileModalCigar] = useState(null);
  const flatListRef = React.useRef(null);

  const isFavoritesWithStacks = view === COLLECTIONS.LIKES;
  const displayData = isFavoritesWithStacks ? groupByBrand(viewList) : viewList;

  const toggleDetails = (num) => {
    if (show) {
      setShow(false)
      setCigarNum(num)
    } else {
      setShow(true)
      setCigarNum(num)
    }
  }

  const refreshList = async () => {
    try {
      let rows;
      if (view === COLLECTIONS.LIKES) {
        rows = await db.getAllAsync(
          "SELECT * FROM cigars WHERE collection = ? OR (collection = ? AND is_favorite = 1)",
          COLLECTIONS.LIKES,
          COLLECTIONS.HUMIDOR
        );
      } else {
        rows = await db.getAllAsync('SELECT * FROM cigars WHERE collection = ?', view);
      }
      setViewList(rows);
    } catch (error) {
      console.log(error);
    }
  };

  const onDislike = async (id) => {
    try {
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

  const toggleFavorite = (cigar, isFavorite) => {
    if (isFavorite) {
      db.runAsync(
        'UPDATE cigars SET is_favorite = 0, favorite_notes = NULL, flavor_profile = NULL, construction_quality = NULL, smoked_date = NULL, flavor_changes = NULL WHERE id = ?',
        cigar.id
      ).then(refreshList).catch((e) => console.log(e));
    } else {
      setFavoriteModalMode('add');
      setFavoriteModalCigar(cigar);
    }
  };

  const handleFavoriteNotesSave = async (notes) => {
    if (!favoriteModalCigar) return;
    try {
      if (favoriteModalMode === 'add') {
        const quantity = Math.max(0, parseInt(favoriteModalCigar.quantity, 10) || 1);
        const isFromHumidor = view === COLLECTIONS.HUMIDOR;
        const shouldLeaveHumidor = isFromHumidor && quantity < 2;
        if (shouldLeaveHumidor) {
          await db.runAsync(
            `UPDATE cigars SET collection = ?, is_favorite = 1, favorite_notes = ?, flavor_profile = ?, construction_quality = ?, smoked_date = ?, flavor_changes = ? WHERE id = ?`,
            COLLECTIONS.LIKES,
            notes.favorite_notes || null,
            notes.flavor_profile || null,
            notes.construction_quality || null,
            notes.smoked_date || null,
            notes.flavor_changes || null,
            favoriteModalCigar.id
          );
        } else {
          const newQuantity = Math.max(1, quantity - 1);
          await db.runAsync(
            `UPDATE cigars SET is_favorite = 1, quantity = ?, favorite_notes = ?, flavor_profile = ?, construction_quality = ?, smoked_date = ?, flavor_changes = ? WHERE id = ?`,
            newQuantity,
            notes.favorite_notes || null,
            notes.flavor_profile || null,
            notes.construction_quality || null,
            notes.smoked_date || null,
            notes.flavor_changes || null,
            favoriteModalCigar.id
          );
        }
      } else {
        await db.runAsync(
          `UPDATE cigars SET favorite_notes = ?, flavor_profile = ?, construction_quality = ?, smoked_date = ?, flavor_changes = ? WHERE id = ?`,
          notes.favorite_notes || null,
          notes.flavor_profile || null,
          notes.construction_quality || null,
          notes.smoked_date || null,
          notes.flavor_changes || null,
          favoriteModalCigar.id
        );
      }
      setFavoriteModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  };

  const openEditNotes = (cigar) => {
    setFavoriteModalMode('edit');
    setFavoriteModalCigar(cigar);
  };

  const handleSmokedOneSave = async (smokedDate) => {
    if (!smokedOneModalCigar) return;
    try {
      const dateToUse = smokedDate?.trim() || new Date().toISOString().slice(0, 10);
      const quantity = Math.max(0, parseInt(smokedOneModalCigar.quantity, 10) || 1);
      const newQuantity = Math.max(0, quantity - 1);
      await db.runAsync(
        'INSERT INTO smoke_history (cigar_id, smoked_at) VALUES (?, ?)',
        smokedOneModalCigar.id,
        dateToUse
      );
      await db.runAsync(
        'UPDATE cigars SET quantity = ? WHERE id = ?',
        newQuantity,
        smokedOneModalCigar.id
      );
      setSmokedOneModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error marking smoked: ${error}`);
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
      setStrengthProfileModalCigar(null);
      refreshList();
    } catch (error) {
      console.log(`Error saving strength profile: ${error}`);
    }
  };

  const removeFromDislikes = async (id) => {
    try {
      await db.runAsync(
        'UPDATE cigars SET collection = ?, is_favorite = 0 WHERE id = ?',
        COLLECTIONS.HUMIDOR,
        id
      );
      refreshList();
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  };

  const deleteCigar = async (id) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
          let rows;
          if (view === COLLECTIONS.LIKES) {
            rows = await db.getAllAsync(
              "SELECT * FROM cigars WHERE collection = ? OR (collection = ? AND is_favorite = 1)",
              COLLECTIONS.LIKES,
              COLLECTIONS.HUMIDOR
            );
          } else {
            rows = await db.getAllAsync('SELECT * FROM cigars WHERE collection = ?', view);
          }
          if (!cancelled) setViewList(rows);
        } catch (error) {
          console.log(error);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [view])
  );

  const toggleStack = (brand) => {
    setExpandedStacks((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const longPressTimerRef = useRef(null);

  const handlePressIn = (cigar) => {
    if (!onEditCigar) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
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

  const renderCigarCard = (cigar, index, detailsKey) => (
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
                <Text style={styles.subText}>{cigar.brand ?? ''}</Text>
                <Text style={styles.subText}>Size: {cigar.length ?? '—'}</Text>
              </View>
            </View>
            <View style={styles.cigarHeaderRight}>
              {view === 'humidor' && (cigar.quantity ?? 1) > 0 ? (
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
          {(view === 'humidor' || view === 'likes' || view === 'dislikes') && (
            <ExpandableFavoriteNotes
              isExpanded={expandedNotes === cigar.id}
              cigar={cigar}
              onEdit={view === 'likes' || view === 'dislikes' ? undefined : () => {
                if (cigar.is_favorite ?? 0) {
                  openEditNotes(cigar);
                } else {
                  setFavoriteModalMode('add');
                  setFavoriteModalCigar(cigar);
                }
              }}
              onOpenStrengthProfile={(c) => setStrengthProfileModalCigar(c)}
            />
          )}
          {(view === 'humidor' || view === 'likes') && (
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
                    size={22}
                    color={
                      (cigar.favorite_notes ?? '').trim() ||
                      (cigar.flavor_profile ?? '').trim() ||
                      (cigar.construction_quality ?? '').trim() ||
                      (cigar.smoked_date ?? '').trim() ||
                      (cigar.flavor_changes ?? '').trim()
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </Pressable>
                <StrengthIndicator
                  strength={getOverallStrength(cigar.strength_profile)}
                  onPress={(e) => {
                    e.stopPropagation();
                    setStrengthProfileModalCigar(cigar);
                  }}
                />
              </View>
              <View style={styles.rightActionIcons}>
                {view === 'humidor' && (cigar.quantity ?? 1) > 1 && (
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
                    name={(cigar.is_favorite ?? 0) ? 'star' : 'star-outline'}
                    size={24}
                    color={(cigar.is_favorite ?? 0) ? colors.primary : colors.textSecondary}
                  />
                </Pressable>
                {view === 'humidor' && (
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
                    size={22}
                    color={
                      (cigar.favorite_notes ?? '').trim() ||
                      (cigar.flavor_profile ?? '').trim() ||
                      (cigar.construction_quality ?? '').trim() ||
                      (cigar.smoked_date ?? '').trim() ||
                      (cigar.flavor_changes ?? '').trim()
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </Pressable>
                <StrengthIndicator
                  strength={getOverallStrength(cigar.strength_profile)}
                  onPress={(e) => {
                    e.stopPropagation();
                    setStrengthProfileModalCigar(cigar);
                  }}
                />
              </View>
              <View style={styles.rightActionIcons}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    removeFromDislikes(cigar.id);
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

  return (
    <>
      {view !== '' && (
        <FlatList
          ref={flatListRef}
          style={styles.listItems}
          data={displayData}
          keyExtractor={(item) =>
            isFavoritesWithStacks ? item.brand : String(item?.id ?? '')
          }
          renderItem={({ item }) => (
            <View style={isFavoritesWithStacks ? styles.stackItemWrapper : undefined}>
              {renderItem(item)}
            </View>
          )}
        />
      )}
      <ImageViewerModal
        visible={!!viewerImage}
        imageUri={viewerImage}
        onClose={() => setViewerImage(null)}
      />
      <FavoriteNotesModal
        visible={!!favoriteModalCigar}
        cigar={favoriteModalCigar}
        initialNotes={favoriteModalCigar ? {
          favorite_notes: favoriteModalCigar.favorite_notes,
          flavor_profile: favoriteModalCigar.flavor_profile,
          construction_quality: favoriteModalCigar.construction_quality,
          smoked_date: favoriteModalCigar.smoked_date,
          flavor_changes: favoriteModalCigar.flavor_changes,
        } : {}}
        onSave={handleFavoriteNotesSave}
        onCancel={() => setFavoriteModalCigar(null)}
      />
      <SmokedOneModal
        visible={!!smokedOneModalCigar}
        cigar={smokedOneModalCigar}
        onSave={handleSmokedOneSave}
        onCancel={() => setSmokedOneModalCigar(null)}
      />
      <StrengthProfileModal
        visible={!!strengthProfileModalCigar}
        cigar={strengthProfileModalCigar}
        initialProfile={strengthProfileModalCigar?.strength_profile}
        onSave={handleStrengthProfileSave}
        onCancel={() => setStrengthProfileModalCigar(null)}
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
