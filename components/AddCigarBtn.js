import { StyleSheet, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { hapticMedium } from '../lib/haptics';
import { useTabBarHeight } from '../navigation/useTabBarHeight';
import { colors, shadows, spacing } from '../theme';
import PressableScale from './ui/PressableScale';

function AddCigarBtn({ onPress }) {
  const tabBarHeight = useTabBarHeight();
  const handlePress = () => {
    hapticMedium();
    onPress?.();
  };

  return (
    <PressableScale
      onPress={handlePress}
      scaleTo={0.92}
      style={[styles.btnContainer, styles.boxShadow, { bottom: spacing.lg + tabBarHeight }]}
      accessibilityLabel="Add cigar"
    >
      <View style={styles.btnIconContainer}>
        <AntDesign name="pluscircle" size={48} color={colors.gold} />
      </View>
    </PressableScale>
  );
}

export default AddCigarBtn;

const styles = StyleSheet.create({
  btnContainer: {
    borderRadius: 28,
    height: 56,
    width: 56,
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(143, 116, 64, 0.5)',
    ...shadows.elevated,
  },
  btnIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
