import { StyleSheet, Text, View } from 'react-native';
import { explainCigarMatch } from '../../lib/matchExplanation';
import { colors, spacing, typography } from '../../theme';

export default function PalateFitNote({
  match,
  confidence = 'low',
  compact = false,
  hideIfWeak = false,
  label = 'For you',
  style,
}) {
  const explanation = explainCigarMatch(match, confidence);
  if (!explanation) return null;
  if (hideIfWeak && explanation.weakSignal) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.headline}>{explanation.headline}</Text>
      {!compact && explanation.detail ? (
        <Text style={styles.detail}>{explanation.detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  label: {
    ...typography.label,
    color: colors.goldMuted,
  },
  headline: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  detail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
