import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { hapticSelection } from '../lib/haptics';
import { PremiumCard, PressableScale } from './ui';
import { borderRadius, colors, spacing, typography } from '../theme';

function formatReading(value, suffix) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${value}${suffix}`;
}

export default function HumidorCard({
  name,
  cigarCount = 0,
  humidity,
  temperature,
  selected = false,
  onPress,
  style,
}) {
  const rh = formatReading(humidity, '% RH');
  const temp = formatReading(temperature, '°F');
  const envParts = [rh, temp].filter(Boolean);

  const handlePress = () => {
    hapticSelection();
    onPress?.();
  };

  return (
    <PressableScale onPress={handlePress} scaleTo={0.97} style={style}>
      <PremiumCard
        variant={selected ? 'warm' : 'subtle'}
        style={[styles.card, selected && styles.cardSelected]}
        contentStyle={styles.content}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="archive"
            size={20}
            color={selected ? colors.gold : colors.textMuted}
          />
          <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={styles.count}>
          {cigarCount} {cigarCount === 1 ? 'Cigar' : 'Cigars'}
        </Text>
        {envParts.length > 0 ? (
          <Text style={styles.env} numberOfLines={1}>
            {envParts.join(' | ')}
          </Text>
        ) : null}
      </PremiumCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
  },
  cardSelected: {
    borderColor: colors.goldMuted,
    borderWidth: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.sectionTitle,
    color: colors.text,
    flex: 1,
  },
  nameSelected: {
    color: colors.goldBright,
  },
  count: {
    ...typography.body,
    color: colors.gold,
    marginTop: spacing.sm,
  },
  env: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
