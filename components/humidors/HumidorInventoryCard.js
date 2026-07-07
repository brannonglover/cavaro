import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useResolvedCigarImage } from '../../hooks/useResolvedCigarImage';
import CigarImage from '../ui/CigarImage';
import { colors, radius, spacing } from '../../theme';

function formatInventorySize(cigar) {
  const length = cigar.length?.trim();
  if (!length) return null;
  const normalized = length.replace(/^size:\s*/i, '');
  return `Size: ${normalized}`;
}

function InventoryChevron({ expanded }) {
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textMuted} />
    </Animated.View>
  );
}

export default function HumidorInventoryCard({
  cigar,
  onMarkSmoked,
  onMove,
  onStartCellaring,
  expanded = false,
  embedded = false,
  style,
}) {
  const quantity = cigar.quantity ?? 1;
  const showActions = quantity > 0;
  const sizeLabel = formatInventorySize(cigar);
  const resolvedAssets = useResolvedCigarImage(cigar);

  return (
    <View style={[styles.card, embedded && styles.cardEmbedded, style]}>
      <View style={styles.row}>
        <View style={styles.imageWrap}>
          <CigarImage
            imageUrl={resolvedAssets.imageUrl}
            wrapper={resolvedAssets.wrapper}
            variant="inventory"
            style={styles.image}
            imageStyle={styles.image}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {cigar.name || 'Unknown'}
            </Text>
            {quantity > 0 ? (
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.brand} numberOfLines={1}>
            {cigar.brand || '—'}
          </Text>

          {showActions ? (
            <View style={styles.actionIcons}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onMarkSmoked?.();
                }}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityLabel="Mark smoked"
              >
                <MaterialCommunityIcons name="fire" size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onMove?.();
                }}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityLabel="Move cigar"
              >
                <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onStartCellaring?.();
                }}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityLabel="Start cellaring"
              >
                <MaterialCommunityIcons name="timer-sand" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}

          {sizeLabel ? (
            <Text style={styles.size} numberOfLines={1}>
              {sizeLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.chevronWrap}>
          <InventoryChevron expanded={expanded} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
  },
  cardEmbedded: {
    marginHorizontal: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  imageWrap: {
    width: 72,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
  },
  brand: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textMuted,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  iconBtn: {
    padding: 2,
    marginRight: 12,
  },
  size: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textMuted,
  },
  quantityBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  quantityText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.white,
  },
  chevronWrap: {
    justifyContent: 'center',
    paddingRight: 12,
    paddingLeft: 2,
  },
});
