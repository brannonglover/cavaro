import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CavaroButton, CigarImage, PremiumCard } from '../ui';
import { borderRadius, colors, spacing, typography } from '../../theme';

export default function SmokeRecommendationCard({
  name,
  brand,
  wrapper,
  reason,
  imageUrl,
  onViewDetails,
  style,
}) {
  const displayName = name || "Tonight's Pick";
  const meta = brand?.trim() || null;

  return (
    <PremiumCard variant="elevated" padding={0} style={[styles.card, style]}>
      <View style={styles.media}>
        <CigarImage
          imageUrl={imageUrl}
          wrapper={wrapper}
          variant="hero"
          style={styles.image}
          imageStyle={styles.image}
        />
        <View style={styles.mediaOverlay} />
      </View>

      <View style={styles.content}>
        <View style={styles.labelRow}>
          <View style={styles.labelIcon}>
            <MaterialCommunityIcons name="cigar" size={16} color={colors.gold} />
          </View>
          <Text style={styles.sectionLabel}>Smoke Recommendation</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {displayName}
        </Text>

        {meta ? (
          <Text style={styles.brand} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}

        {reason ? (
          <Text style={styles.reason} numberOfLines={2}>
            {reason}
          </Text>
        ) : null}

        {onViewDetails ? (
          <CavaroButton
            variant="ghost"
            label="View Details →"
            onPress={onViewDetails}
            style={styles.action}
          />
        ) : null}

        <View style={styles.watermark} pointerEvents="none">
          <MaterialCommunityIcons name="star-four-points-outline" size={56} color="rgba(200, 164, 93, 0.1)" />
        </View>
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  media: {
    height: 168,
    backgroundColor: colors.surface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 9, 0.2)',
  },
  content: {
    padding: spacing.md,
    backgroundColor: colors.surfaceWarm,
    position: 'relative',
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  labelIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.goldMuted,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  brand: {
    ...typography.body,
    color: colors.goldBright,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  reason: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: -spacing.sm,
  },
  watermark: {
    position: 'absolute',
    right: -4,
    bottom: -6,
  },
});
