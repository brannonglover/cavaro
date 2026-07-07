import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';
import CigarImage from './CigarImage';
import PremiumCard from './PremiumCard';

export default function CigarCard({
  name,
  brand,
  line,
  vitola,
  wrapper,
  quantity,
  imageUrl,
  rating,
  subtitle,
  compact = false,
  onPress,
  footer,
  style,
}) {
  const meta = [brand, line].filter(Boolean).join(' · ');
  const detail = vitola || subtitle;

  return (
    <PremiumCard
      onPress={onPress}
      variant="subtle"
      style={[compact ? styles.compact : styles.full, style]}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={compact ? 1 : 2}>
            {name || 'Unknown'}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>

        <View style={styles.trailing}>
          {typeof quantity === 'number' && quantity > 0 ? (
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>×{quantity}</Text>
            </View>
          ) : null}
          {typeof rating === 'number' ? (
            <Text style={styles.rating}>{rating}</Text>
          ) : null}
          <CigarImage
            imageUrl={imageUrl}
            wrapper={wrapper}
            variant="thumbnail"
            style={styles.image}
          />
        </View>
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  full: {
    marginBottom: spacing.md,
  },
  compact: {
    width: 260,
    marginRight: spacing.md,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  name: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  detail: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
  quantityBadge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quantityText: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '600',
  },
  rating: {
    ...typography.sectionTitle,
    color: colors.gold,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
