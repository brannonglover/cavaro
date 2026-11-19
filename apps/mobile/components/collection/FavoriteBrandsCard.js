import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PremiumCard } from '../ui';
import { borderRadius, colors, spacing, typography } from '../../theme';

function getBrandInitials(brand) {
  const parts = brand.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return brand.slice(0, 2).toUpperCase();
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

function FavoriteBrandRow({ brand, smokeCount, rank, isLast }) {
  const isTop = rank === 1;

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={[styles.rankBadge, isTop && styles.rankBadgeTop]}>
        {isTop ? (
          <MaterialCommunityIcons name="crown" size={12} color={colors.goldBright} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>
      <View style={[styles.avatar, isTop && styles.avatarTop]}>
        <Text style={[styles.avatarText, isTop && styles.avatarTextTop]}>
          {getBrandInitials(brand)}
        </Text>
      </View>
      <Text style={[styles.brandName, isTop && styles.brandNameTop]} numberOfLines={1}>
        {brand}
      </Text>
      <View style={[styles.countPill, isTop && styles.countPillTop]}>
        <Text style={[styles.countText, isTop && styles.countTextTop]}>
          {formatCount(smokeCount)}
        </Text>
      </View>
    </View>
  );
}

export default function FavoriteBrandsCard({ brands, style }) {
  const rows = (brands ?? []).filter((row) => row?.brand);
  if (rows.length === 0) return null;

  return (
    <PremiumCard variant="elevated" style={[styles.card, style]} padding={0}>
      <View style={styles.watermark} pointerEvents="none">
        <MaterialCommunityIcons name="tag-multiple-outline" size={52} color="rgba(200, 164, 93, 0.12)" />
      </View>
      <View style={styles.body}>
        {rows.map((row, index) => (
          <FavoriteBrandRow
            key={row.brand}
            brand={row.brand}
            smokeCount={row.smoke_count}
            rank={index + 1}
            isLast={index === rows.length - 1}
          />
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -2,
    top: 14,
  },
  body: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankBadgeTop: {
    backgroundColor: 'rgba(200, 164, 93, 0.18)',
  },
  rankText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarTop: {
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
  },
  avatarText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  avatarTextTop: {
    color: colors.goldBright,
  },
  brandName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    fontWeight: '500',
  },
  brandNameTop: {
    color: colors.goldBright,
    fontWeight: '600',
  },
  countPill: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
  },
  countPillTop: {
    backgroundColor: 'rgba(200, 164, 93, 0.14)',
  },
  countText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  countTextTop: {
    color: colors.gold,
  },
});
