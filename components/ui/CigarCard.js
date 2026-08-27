import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ImageViewerModal from '../ImageViewerModal';
import { useResolvedCigarImage } from '../../hooks/useResolvedCigarImage';
import { productImageUrl } from '../../lib/cigarImage';
import { hapticLight } from '../../lib/haptics';
import { borderRadius, colors, spacing, typography } from '../../theme';
import CigarImage from './CigarImage';
import PremiumCard from './PremiumCard';
import PressableScale from './PressableScale';

export default function CigarCard({
  name,
  brand,
  line,
  vitola,
  wrapper,
  quantity,
  imageUrl,
  cigarId,
  rating,
  subtitle,
  compact = false,
  imageLayout = 'portrait',
  onPress,
  onImagePress,
  footer,
  style,
}) {
  const meta = [brand, line].filter(Boolean).join(' · ');
  const detail = vitola || subtitle;
  const resolved = useResolvedCigarImage({
    id: cigarId,
    brand,
    name,
    line,
    length: vitola,
    image: imageUrl,
    wrapper,
  });
  const portrait = imageLayout === 'portrait';
  const displayUrl = resolved.imageUrl || productImageUrl(imageUrl) || null;
  const displayWrapper = resolved.wrapper || wrapper;
  const [viewerOpen, setViewerOpen] = useState(false);
  const canEnlarge = Boolean(displayUrl);

  const handleImagePress = () => {
    if (!displayUrl) {
      onPress?.();
      return;
    }
    hapticLight();
    if (onImagePress) {
      onImagePress(displayUrl);
      return;
    }
    setViewerOpen(true);
  };

  const viewer = onImagePress ? null : (
    <ImageViewerModal
      visible={viewerOpen}
      imageUri={displayUrl}
      onClose={() => setViewerOpen(false)}
    />
  );

  const info = (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={compact && !portrait ? 1 : 2}>
          {name || 'Unknown'}
        </Text>
        {typeof quantity === 'number' && quantity > 0 ? (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>×{quantity}</Text>
          </View>
        ) : null}
        {typeof rating === 'number' ? (
          <Text style={styles.rating}>{rating}</Text>
        ) : null}
      </View>
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
    </>
  );

  if (portrait) {
    return (
      <>
        <PremiumCard
          variant="subtle"
          padding={0}
          style={[compact ? styles.compact : styles.full, style]}
        >
          <View style={styles.portraitRow}>
            <Pressable
              onPress={handleImagePress}
              style={styles.portraitImageWrap}
              accessibilityRole="imagebutton"
              accessibilityLabel={canEnlarge ? `View photo of ${name || 'cigar'}` : name}
            >
              <CigarImage
                imageUrl={displayUrl}
                wrapper={displayWrapper}
                variant="inventory"
                style={styles.portraitImage}
                imageStyle={styles.portraitImage}
              />
              {canEnlarge ? (
                <View style={styles.portraitHint} pointerEvents="none">
                  <MaterialCommunityIcons name="fullscreen" size={14} color={colors.goldMuted} />
                </View>
              ) : null}
            </Pressable>
            <PressableScale
              onPress={onPress}
              disabled={!onPress}
              style={styles.portraitBody}
              scaleTo={0.985}
            >
              {info}
              {footer ? <View style={styles.portraitFooter}>{footer}</View> : null}
            </PressableScale>
          </View>
        </PremiumCard>
        {viewer}
      </>
    );
  }

  return (
    <>
      <PremiumCard
        onPress={onPress}
        variant="subtle"
        style={[compact ? styles.compact : styles.full, style]}
        contentStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.info}>{info}</View>
          <Pressable onPress={handleImagePress} disabled={!canEnlarge}>
            <CigarImage
              imageUrl={displayUrl}
              wrapper={displayWrapper}
              variant="thumbnail"
              style={styles.image}
            />
          </Pressable>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </PremiumCard>
      {viewer}
    </>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    ...typography.sectionTitle,
    color: colors.text,
    flex: 1,
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
  portraitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 148,
  },
  portraitImageWrap: {
    width: 96,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  portraitImage: {
    ...StyleSheet.absoluteFillObject,
  },
  portraitHint: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 11, 9, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitBody: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  portraitFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
