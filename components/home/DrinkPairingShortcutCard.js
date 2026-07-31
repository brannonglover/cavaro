import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PremiumCard } from '../ui';
import { borderRadius, colors, spacing, typography } from '../../theme';

/**
 * Home shortcut into the Drink Pairing screen (no auto-fetch).
 */
export default function DrinkPairingShortcutCard({ onPress, style }) {
  return (
    <PremiumCard variant="warm" style={[styles.card, style]} onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="glass-cocktail" size={22} color={colors.gold} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Drink Pairing</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            AI suggestions for what to sip with your smoke
          </Text>
        </View>
      </View>
      <Text style={styles.action}>Find a pairing →</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  action: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
    marginTop: spacing.md,
  },
});
