import { Modal, View, Image, Pressable, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export default function ImageViewerModal({ visible, imageUri, onClose }) {
  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕ Close</Text>
        </Pressable>
        <Pressable style={styles.imageWrap} onPress={onClose}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
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
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 12,
  },
  closeText: {
    fontSize: 17,
    color: colors.cardBg,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: '80%',
  },
});
