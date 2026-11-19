import React from 'react';
import {
  InputAccessoryView,
  Platform,
  Pressable,
  StyleSheet,
  Keyboard,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';

export const KEYBOARD_ACCESSORY_ID = 'keyboardDismiss';

export default function KeyboardAccessory() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable
          style={styles.doneBtn}
          onPress={() => Keyboard.dismiss()}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="check" size={24} color={colors.primary} />
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  doneBtn: {
    padding: 8,
  },
});
