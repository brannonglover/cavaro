import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CavaroText } from '../ui';
import { hapticMedium } from '../../lib/haptics';
import { colors, spacing } from '../../theme';

export default function HumidorsHeader({ cigarCountLabel, onAddPress, style }) {
  const subtitle = cigarCountLabel
    ? `Current inventory  •  ${cigarCountLabel}`
    : 'Current inventory';

  const handleAddPress = () => {
    hapticMedium();
    onAddPress?.();
  };

  return (
    <View style={[styles.header, style]}>
      <View style={styles.copy}>
        <CavaroText variant="title">Humidors</CavaroText>
        <CavaroText variant="body" tone="muted" style={styles.subtitle}>
          {subtitle}
        </CavaroText>
      </View>
      {onAddPress ? (
        <Pressable
          onPress={handleAddPress}
          style={styles.headerAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Add cigar"
        >
          <MaterialCommunityIcons name="plus" size={24} color={colors.gold} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  headerAction: {
    minWidth: 44,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
});
