import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchBadge } from '../ui';
import TasteAccentCard from './TasteAccentCard';
import { explainCigarMatch } from '../../lib/matchExplanation';
import { borderRadius, colors, spacing, typography } from '../../theme';

const LEVEL_STYLES = {
  'Needs Another Chance': {
    accent: colors.warning,
    watermark: 'history',
    watermarkColor: 'rgba(196, 154, 74, 0.12)',
    icon: 'history',
    iconColor: colors.warning,
    iconBg: 'rgba(196, 154, 74, 0.16)',
  },
  'Unlikely Match': {
    accent: colors.danger,
    watermark: 'close-circle-outline',
    watermarkColor: 'rgba(184, 92, 74, 0.12)',
    icon: 'close-circle-outline',
    iconColor: colors.danger,
    iconBg: 'rgba(184, 92, 74, 0.14)',
  },
  'Mixed Experience': {
    accent: colors.warning,
    watermark: 'help-circle-outline',
    watermarkColor: 'rgba(196, 154, 74, 0.12)',
    icon: 'help-circle-outline',
    iconColor: colors.warning,
    iconBg: 'rgba(196, 154, 74, 0.16)',
  },
};

const DEFAULT_STYLE = LEVEL_STYLES['Needs Another Chance'];

export default function MatchInsightCard({ cigar, level, reason, score, style }) {
  const tokens = LEVEL_STYLES[level] ?? DEFAULT_STYLE;
  const meta = [cigar?.brand, cigar?.line].filter(Boolean).join(' · ') || '—';
  const explanation = explainCigarMatch({ level, reasons: [], score });

  return (
    <TasteAccentCard
      variant="subtle"
      watermarkIcon={tokens.watermark}
      watermarkColor={tokens.watermarkColor}
      style={style}
      bodyStyle={styles.body}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: tokens.iconBg }]}>
          <MaterialCommunityIcons name={tokens.icon} size={18} color={tokens.iconColor} />
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {cigar?.name || 'Unknown'}
            </Text>
            <MatchBadge level={level} label={explanation?.headline} />
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          <Text style={styles.reason}>{reason}</Text>
          {typeof score === 'number' ? (
            <Text style={styles.score}>Match score {score}</Text>
          ) : null}
        </View>
      </View>
    </TasteAccentCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.sectionTitle,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  reason: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginTop: spacing.xs,
  },
  score: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
});
