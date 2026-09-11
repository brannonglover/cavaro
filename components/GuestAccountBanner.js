import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export default function GuestAccountBanner({ onCreateAccount }) {
  return (
    <Pressable style={styles.card} onPress={onCreateAccount}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={22} color={colors.gold} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Using Cavaro as a guest</Text>
        <Text style={styles.subtitle}>
          Create an account to back up your collection and access it across devices.
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm || '#2A1E14',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gold + '33',
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
