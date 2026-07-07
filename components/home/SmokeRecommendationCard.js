import { StyleSheet, View } from 'react-native';
import { CavaroButton, CavaroText, CigarImage, PremiumCard } from '../ui';
import { colors, spacing } from '../../theme';

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
      </View>

      <View style={styles.content}>
        <CavaroText variant="label" style={styles.sectionLabel}>
          Smoke Recommendation
        </CavaroText>

        <CavaroText variant="title" numberOfLines={2}>
          {displayName}
        </CavaroText>

        {meta ? (
          <CavaroText variant="body" numberOfLines={1} style={styles.brand}>
            {meta}
          </CavaroText>
        ) : null}

        {reason ? (
          <CavaroText variant="body" tone="muted" numberOfLines={2} style={styles.reason}>
            {reason}
          </CavaroText>
        ) : null}

        {onViewDetails ? (
          <CavaroButton
            variant="ghost"
            label="View Details →"
            onPress={onViewDetails}
            style={styles.action}
          />
        ) : null}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xl,
  },
  media: {
    height: 180,
    backgroundColor: colors.surface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.goldMuted,
    marginBottom: spacing.xs,
  },
  brand: {
    marginTop: spacing.xs,
  },
  reason: {
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: -spacing.sm,
  },
});
