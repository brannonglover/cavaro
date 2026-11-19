import { Modal, View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CigarImage from './ui/CigarImage';
import { colors } from '../theme';

export default function ImageViewerModal({ visible, imageUri, onClose }) {
  const insets = useSafeAreaInsets();
  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕ Close</Text>
        </Pressable>
        <Pressable style={styles.imageWrap} onPress={onClose}>
          <CigarImage
            imageUrl={imageUri}
            variant="full"
            style={styles.image}
          />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeText: {
    fontSize: 17,
    color: colors.gold,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
