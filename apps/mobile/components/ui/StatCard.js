import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../theme';
import PremiumCard from './PremiumCard';

const COLLECTION_ACCENTS = {
  gold: {
    bar: colors.gold,
    icon: colors.gold,
    value: colors.goldBright,
    glow: 'rgba(200, 164, 93, 0.16)',
  },
  amber: {
    bar: colors.goldBright,
    icon: colors.goldBright,
    value: colors.goldBright,
    glow: 'rgba(215, 186, 115, 0.14)',
  },
  sage: {
    bar: colors.success,
    icon: colors.success,
    value: colors.success,
    glow: 'rgba(126, 159, 109, 0.16)',
  },
  tobacco: {
    bar: colors.goldMuted,
    icon: colors.goldMuted,
    value: colors.gold,
    glow: 'rgba(143, 116, 64, 0.2)',
  },
};

export default function StatCard({
  label,
  value,
  icon,
  layout = 'default',
  accent = 'gold',
  highlight = true,
  compact = false,
  onPress,
  accessibilityLabel,
  style,
}) {
  const isGlance = layout === 'glance';
  const isCollection = layout === 'collection';
  const accentTokens = COLLECTION_ACCENTS[accent] ?? COLLECTION_ACCENTS.gold;

  return (
    <PremiumCard
      variant={
        isCollection ? 'elevated' : isGlance ? 'default' : highlight ? 'warm' : 'subtle'
      }
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? (onPress ? `${value} ${label}` : undefined)}
      style={[
        styles.card,
        highlight && !isGlance && !isCollection && styles.cardHighlight,
        isGlance && styles.cardGlance,
        isCollection && styles.cardCollection,
        style,
      ]}
      padding={isGlance || isCollection ? 0 : compact ? spacing.md : undefined}
      contentStyle={isGlance ? styles.glanceContent : isCollection ? styles.collectionContent : undefined}
    >
      {isCollection ? (
        <View style={styles.collectionInner}>
          {icon ? (
            <View style={styles.collectionWatermark} pointerEvents="none">
              <MaterialCommunityIcons name={icon} size={44} color={accentTokens.glow} />
            </View>
          ) : null}
          <View style={styles.collectionBody}>
            {icon ? (
              <View style={[styles.collectionIconWrap, { backgroundColor: accentTokens.glow }]}>
                <MaterialCommunityIcons name={icon} size={16} color={accentTokens.icon} />
              </View>
            ) : null}
            <View style={styles.collectionText}>
              <Text
                style={[styles.collectionValue, { color: accentTokens.value }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {value}
              </Text>
              <Text style={styles.collectionLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
        </View>
      ) : isGlance ? (
        <View style={styles.glanceInner}>
          {icon ? (
            <MaterialCommunityIcons name={icon} size={20} color={colors.gold} />
          ) : null}
          <Text
            style={styles.glanceValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {value}
          </Text>
          <Text
            style={styles.glanceLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {label}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={2}>
            {label}
          </Text>
          <Text
            style={[
              styles.value,
              compact && styles.valueCompact,
              highlight && styles.valueHighlight,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {value}
          </Text>
        </>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
    borderRadius: borderRadius.md,
  },
  cardGlance: {
    minWidth: 0,
    minHeight: 108,
  },
  cardCollection: {
    flex: 0,
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  cardHighlight: {
    borderColor: 'rgba(143, 116, 64, 0.45)',
  },
  collectionContent: {
    flexGrow: 0,
  },
  collectionInner: {
    position: 'relative',
  },
  collectionWatermark: {
    position: 'absolute',
    right: -4,
    top: 10,
    opacity: 0.85,
  },
  collectionBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  collectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  collectionText: {
    flex: 1,
    minWidth: 0,
  },
  collectionValue: {
    ...typography.sectionTitle,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
  },
  collectionLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 2,
  },
  glanceContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  glanceInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  glanceValue: {
    ...typography.metric,
    color: colors.text,
    textAlign: 'center',
    width: '100%',
  },
  glanceLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    width: '100%',
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelCompact: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
  value: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  valueCompact: {
    ...typography.sectionTitle,
    marginTop: spacing.sm,
  },
  valueHighlight: {
    color: colors.gold,
  },
});
