import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeedbackModal from './FeedbackModal';
import colors from '../theme/colors';

export default function FeedbackBtn() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={styles.btn}
        hitSlop={12}
      >
        <MaterialCommunityIcons
          name="message-text-outline"
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>
      <FeedbackModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 8,
    marginLeft: 8,
  },
});
