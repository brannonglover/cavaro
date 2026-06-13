import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DatePickerField, { getTodayDateString } from './DatePickerField';
import colors from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AddToFavoritesModal({ visible, cigar, onAdd, onCancel }) {
  const [smokedDate, setSmokedDate] = useState(getTodayDateString());
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setSmokedDate(getTodayDateString());
    }
  }, [visible]);

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
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onCancel());
  };

  const handleAdd = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onAdd(smokedDate.trim() || null));
  };

  if (!cigar) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </Pressable>
        <View style={styles.sheetWrapper}>
          <Pressable onPress={() => {}}>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="heart-plus-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.title}>Add to favorites</Text>
              <Text style={styles.subtitle}>
                {[cigar.brand, cigar.line, cigar.name].filter(Boolean).join(' · ') || '—'}
              </Text>
              <Text style={styles.hint}>
                Add this cigar to your favorites.
              </Text>
              <View style={styles.dateSection}>
                <DatePickerField
                  label="Date smoked"
                  value={smokedDate}
                  onChange={setSmokedDate}
                  placeholder="Tap to pick date"
                  optional={true}
                />
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.addBtn} onPress={handleAdd}>
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 34,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    paddingTop: 4,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  dateSection: {
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 24,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  addText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.screenBg,
  },
});
