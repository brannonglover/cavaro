import React, { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, FlatList, Pressable, Image, Animated } from 'react-native';
import { db, COLLECTIONS } from '../db';
import colors from '../theme/colors';
import ImageViewerModal from './ImageViewerModal';

function ExpandableDetails({ isExpanded, cigar }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const maxHeight = useRef(new Animated.Value(0)).current;
  const marginTop = useRef(new Animated.Value(0)).current;

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
    ]).start();
  }, [isExpanded, opacity, maxHeight, marginTop]);

  return (
    <Animated.View style={[
      styles.attributesShow,
      {
        opacity,
        maxHeight,
        marginTop,
        overflow: 'hidden',
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

export default function CigarList({view}) {
  const [show, setShow] = useState(false);
  const [cigarNum, setCigarNum] = useState(0);
  const [viewList, setViewList] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);

  const toggleDetails = (num) => {
    if (show) {
      setShow(false)
      setCigarNum(num)
    } else {
      setShow(true)
      setCigarNum(num)
    }
  }

  const renderRightView = (id) => (
    <Pressable style={[styles.swipeBtn, styles.likeBtn]} onPress={() => onLike(id)}>
      <Text style={styles.swipeBtnText}>Like</Text>
    </Pressable>
  );

  const renderLeftView = (id) => (
    <Pressable style={[styles.swipeBtn, styles.dislikeBtn]} onPress={() => onDislike(id)}>
      <Text style={styles.swipeBtnText}>Dislike</Text>
    </Pressable>
  );

  const refreshList = async () => {
    try {
      const rows = await db.getAllAsync('SELECT * FROM cigars WHERE collection = ?', view);
      setViewList(rows);
    } catch (error) {
      console.log(error);
    }
  };

  const onDislike = async (id) => {
    try {
      await db.runAsync('UPDATE cigars SET collection = ? WHERE id = ?', COLLECTIONS.DISLIKES, id);
      console.log('Cigar moved to Dislikes');
      refreshList();
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  };

  const onLike = async (id) => {
    try {
      await db.runAsync('UPDATE cigars SET collection = ? WHERE id = ?', COLLECTIONS.LIKES, id);
      console.log('Cigar moved to Likes');
      refreshList();
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }

  let row = [];
  let prevOpenedRow;
  const closeRow = (index) => {
    if (prevOpenedRow && prevOpenedRow !== row[index]) {
      prevOpenedRow.close();
    }
    prevOpenedRow = row[index];
  }

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      db.getAllAsync('SELECT * FROM cigars WHERE collection = ?', view)
        .then((rows) => {
          if (!cancelled) setViewList(rows);
        })
        .catch((error) => console.log(error));
      return () => { cancelled = true; };
    }, [view])
  );

  return (
    <>
      {view !== '' && (
        <FlatList
          style={styles.listItems}
          data={viewList}
          keyExtractor={(item, index) => String(item?.id ?? index)}
          renderItem={cigar => {
            return(
            <Swipeable
              renderRightActions={() => renderRightView(cigar.item.id)}
              renderLeftActions={() => renderLeftView(cigar.item.id)}
              onSwipeableOpen={() => closeRow(cigar.index)}
              ref={(ref) => row[cigar.index] = ref}
              rightOpenValue={-100}
            >
              <Pressable onPress={() => toggleDetails(cigar.index)}>
                <View key={cigar.index} style={styles.cigar}>
                  <View style={styles.cigarHeader}>
                    <View style={styles.cigarInfo}>
                      <Text style={styles.listItem}>{cigar.item.name ?? 'Unknown'}</Text>
                      <View style={styles.subTextWrap}>
                        <Text style={styles.subText}>{cigar.item.brand ?? ''}</Text>
                        <Text style={styles.subText}>Size: {cigar.item.length ?? '—'}</Text>
                      </View>
                    </View>
                    {cigar.item.image ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setViewerImage(cigar.item.image);
                        }}
                        style={styles.thumbnailWrap}
                      >
                        <Image source={{ uri: cigar.item.image }} style={styles.thumbnail} />
                        <Text style={styles.tapHint}>Tap to view</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <ExpandableDetails
                    isExpanded={show && cigar.index === cigarNum}
                    cigar={cigar.item}
                  />
                </View>
              </Pressable>
            </Swipeable>
      )}}
        />
      )}
      <ImageViewerModal
        visible={!!viewerImage}
        imageUri={viewerImage}
        onClose={() => setViewerImage(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  cigar: {
    padding: 18,
    paddingBottom: 16,
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginBottom: 12,
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
  listItem: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subTextWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  subText: {
    fontSize: 14,
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
    fontSize: 10,
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
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  swipeBtn: {
    width: 90,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    borderRadius: 12,
  },
  likeBtn: {
    backgroundColor: colors.like,
    marginLeft: 8,
  },
  dislikeBtn: {
    backgroundColor: colors.dislike,
    marginRight: 8,
  },
  swipeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
