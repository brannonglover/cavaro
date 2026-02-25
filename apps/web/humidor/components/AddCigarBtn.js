import { View, Pressable, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import colors from '../theme/colors';

function AddCigarBtn({ onPress }) {
  return (
    <Pressable style={[styles.btnContainer, styles.boxShadow]} onPress={onPress}>
      <View style={styles.btnIconContainer}>
        <AntDesign name="pluscircle" size={48} color={colors.accent} />
      </View>
    </Pressable>
  )
}

export default AddCigarBtn;

const styles = StyleSheet.create({
  btnContainer: {
    borderRadius: 28,
    height: 56,
    width: 56,
    position: 'absolute',
    bottom: 15,
    right: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  boxShadow: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  btnIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  }
});