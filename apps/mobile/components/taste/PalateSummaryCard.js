import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TasteAccentCard from './TasteAccentCard';
import { borderRadius, colors, spacing, typography } from '../../theme';

const TRAIT_ACCENTS = {
  gold: { bg: 'rgba(200, 164, 93, 0.16)', text: colors.goldBright, icon: colors.gold },
  sage: { bg: 'rgba(126, 159, 109, 0.16)', text: colors.success, icon: colors.success },
  amber: { bg: 'rgba(215, 186, 115, 0.14)', text: colors.goldBright, icon: colors.goldBright },
  tobacco: { bg: 'rgba(143, 116, 64, 0.18)', text: colors.gold, icon: colors.goldMuted },
};

function PalateTrait({ label, icon, accent = 'gold' }) {
  const tokens = TRAIT_ACCENTS[accent] ?? TRAIT_ACCENTS.gold;

  return (
    <View style={[styles.trait, { backgroundColor: tokens.bg }]}>
      <MaterialCommunityIcons name={icon} size={14} color={tokens.icon} />
      <Text style={[styles.traitText, { color: tokens.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function buildTraits(profile) {
  const traits = [];

  if (profile?.preferredStrength) {
    traits.push({ key: 'strength', label: profile.preferredStrength, icon: 'fire', accent: 'gold' });
  }
  for (const wrapper of profile?.favoriteWrappers?.slice(0, 1) ?? []) {
    traits.push({ key: `wrapper-${wrapper}`, label: wrapper, icon: 'leaf', accent: 'sage' });
  }
  for (const country of profile?.favoriteCountries?.slice(0, 1) ?? []) {
    traits.push({ key: `country-${country}`, label: country, icon: 'earth', accent: 'tobacco' });
  }
  for (const flavor of profile?.favoriteFlavors?.slice(0, 2) ?? []) {
    traits.push({ key: `flavor-${flavor}`, label: flavor, icon: 'flower-tulip-outline', accent: 'amber' });
  }

  return traits.slice(0, 4);
}

export default function PalateSummaryCard({ profile, style }) {
  const traits = buildTraits(profile);

  return (
    <TasteAccentCard
      variant="warm"
      watermarkIcon="heart-pulse"
      style={style}
      bodyStyle={styles.body}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={colors.gold} />
        </View>
        <Text style={styles.headerLabel}>Your palate profile</Text>
      </View>
      {traits.length > 0 ? (
        <View style={styles.traitRow}>
          {traits.map((trait) => (
            <PalateTrait key={trait.key} label={trait.label} icon={trait.icon} accent={trait.accent} />
          ))}
        </View>
      ) : (
        <Text style={styles.fallback}>
          Keep logging ratings and flavors to refine your palate.
        </Text>
      )}
    </TasteAccentCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  traitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  trait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  traitText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  fallback: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
