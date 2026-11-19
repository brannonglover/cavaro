import { StyleSheet, View } from 'react-native';
import { CavaroButton, CavaroText } from '../ui';
import { spacing } from '../../theme';
import { hapticMedium } from '../../lib/haptics';

export default function HumidorsFab({ onPress, bottom = spacing.lg, style }) {
  const handlePress = () => {
    hapticMedium();
    onPress?.();
  };

  return (
    <View style={[styles.wrap, { bottom }, style]} pointerEvents="box-none">
      <CavaroButton
        variant="floating"
        icon="plus"
        onPress={handlePress}
        accessibilityLabel="Add Cigar"
      />
      <CavaroText variant="caption" tone="gold" style={styles.label}>
        Add Cigar
      </CavaroText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontWeight: '600',
  },
});
