import React, { useState, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, FlatList, Pressable, Image, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, COLLECTIONS } from '../db';
import colors from '../theme/colors';
import ImageViewerModal from './ImageViewerModal';
import FavoriteNotesModal from './FavoriteNotesModal';

function ExpandableFavoriteNotes({ isExpanded, cigar, onEdit }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(-16)).current;

  const hasNotes =
    (cigar.favorite_notes ?? '').trim() ||
    (cigar.flavor_profile ?? '').trim() ||
    (cigar.construction_quality ?? '').trim() ||
    (cigar.smoked_date ?? '').trim() ||
    (cigar.flavor_changes ?? '').trim();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(maxHeight, {
        toValue: isExpanded ? 400 : 0,
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

  const firstRowContent = !hasNotes ? (
    <Text style={styles.notesEmpty}>No notes yet.</Text>
  ) : (
    <View style={styles.notesBlock}>
      <Text style={styles.notesLabel}>{allBlocks[0].label}</Text>
      <Text style={styles.notesText}>{allBlocks[0].text}</Text>
    </View>
  );

  const remainingBlocks = allBlocks.slice(1).map((block) => (
    <View key={block.label} style={styles.notesBlock}>
      <Text style={styles.notesLabel}>{block.label}</Text>
      <Text style={styles.notesText}>{block.text}</Text>
    </View>
  ));

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
        </View>
      </View>
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

export default function CigarList({view}) {
  const [show, setShow] = useState(false);
  const [cigarNum, setCigarNum] = useState(0);
  const [viewList, setViewList] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);
  const [expandedStacks, setExpandedStacks] = useState({});
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [favoriteModalCigar, setFavoriteModalCigar] = useState(null);
  const [favoriteModalMode, setFavoriteModalMode] = useState('add');
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
        await db.runAsync(
          `UPDATE cigars SET is_favorite = 1, favorite_notes = ?, flavor_profile = ?, construction_quality = ?, smoked_date = ?, flavor_changes = ? WHERE id = ?`,
          notes.favorite_notes || null,
          notes.flavor_profile || null,
          notes.construction_quality || null,
          notes.smoked_date || null,
          notes.flavor_changes || null,
          favoriteModalCigar.id
        );
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

  useFocusEffect(
    React.useCallback(() => {
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

  const renderCigarCard = (cigar, index, detailsKey) => (
    <View style={styles.listItemWrapper} key={cigar.id}>
      <Pressable onPress={() => toggleDetails(detailsKey)}>
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
            />
          )}
          {(view === 'humidor' || view === 'likes') && (
            <View style={styles.actionIcons}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setExpandedNotes((prev) => (prev === cigar.id ? null : cigar.id));
                }}
                hitSlop={8}
                style={styles.notesIconBtn}
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
              <View style={styles.rightActionIcons}>
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
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setExpandedNotes((prev) => (prev === cigar.id ? null : cigar.id));
                }}
                hitSlop={8}
                style={styles.notesIconBtn}
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
            <MaterialCommunityIcons
              name="chevron-down"
              size={24}
              color={colors.textSecondary}
            />
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
              <MaterialCommunityIcons
                name="chevron-up"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
            {cigars.map((cigar, i) => renderCigarCard(cigar, i, cigar.id))}
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
    </>
  );
}

const styles = StyleSheet.create({
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
  stackItemWrapper: {
    marginBottom: 0,
  },
});
