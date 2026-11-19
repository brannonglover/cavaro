import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * A Cavaro-styled confirmation modal with optional warning appearance.
 * @param {boolean} visible
 * @param {string} title
 * @param {string} message
 * @param {Array<{text: string, onPress: () => void, style?: 'cancel'|'destructive'|'default'}>} buttons
 * @param {function} onClose - called when overlay is tapped
 * @param {string} variant - 'warning' for amber accent, default for primary
 */
export default function ConfirmModal({ visible, title, message, buttons = [], onClose, variant = 'warning' }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  const accentColor = variant === 'warning' ? colors.warning : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents="none"
        />
      </Pressable>
      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: sheetTranslateY }], borderColor: accentColor },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
            <MaterialCommunityIcons
              name={variant === 'warning' ? 'alert-circle-outline' : 'information-outline'}
              size={32}
              color={accentColor}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {buttons.map((btn) => (
              <Pressable
                key={btn.text}
                onPress={() => btn.onPress?.()}
                style={[
                  styles.btn,
                  btn.style === 'cancel' && styles.cancelBtn,
                  btn.style === 'destructive' && [styles.destructiveBtn, { borderColor: colors.dislike }],
                ]}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'cancel' && styles.cancelText,
                    btn.style === 'destructive' && { color: colors.dislike },
                    btn.style !== 'cancel' && btn.style !== 'destructive' && { color: accentColor, fontWeight: '600' },
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelBtn: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  destructiveBtn: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 17,
    color: colors.textPrimary,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
