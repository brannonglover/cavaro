import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../theme';
import PremiumCard from './PremiumCard';

export default function StatCard({
  label,
  value,
  icon,
  layout = 'default',
  highlight = true,
  compact = false,
  style,
}) {
  const isGlance = layout === 'glance';

  return (
    <PremiumCard
      variant={isGlance ? 'default' : highlight ? 'warm' : 'subtle'}
      style={[
        styles.card,
        highlight && !isGlance && styles.cardHighlight,
        isGlance && styles.cardGlance,
        style,
      ]}
      padding={isGlance ? 0 : compact ? spacing.md : undefined}
      contentStyle={isGlance ? styles.glanceContent : undefined}
    >
      {isGlance ? (
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
  cardHighlight: {
    borderColor: 'rgba(143, 116, 64, 0.45)',
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
