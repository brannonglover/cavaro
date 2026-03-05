import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import DatePickerField from './DatePickerField';
import colors from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FavoriteNotesModal({
  visible,
  cigar,
  initialNotes = {},
  onSave,
  onCancel,
}) {
  const [whyLiked, setWhyLiked] = useState('');
  const [constructionQuality, setConstructionQuality] = useState('');
  const [smokedDate, setSmokedDate] = useState('');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setWhyLiked(initialNotes.favorite_notes ?? '');
      setConstructionQuality(initialNotes.construction_quality ?? '');
      setSmokedDate(initialNotes.smoked_date ?? '');
    }
  }, [visible, initialNotes]);

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

  const handleSave = () => {
    const notes = {
      favorite_notes: whyLiked.trim(),
      construction_quality: constructionQuality.trim(),
      smoked_date: smokedDate.trim(),
    };
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
    ]).start(() => onSave(notes));
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
        <KeyboardAvoidingView
          style={styles.sheetWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <Text style={styles.title}>Why did you like this cigar?</Text>
            <Text style={styles.subtitle}>
              {cigar.brand ?? ''} · {cigar.name ?? ''}
            </Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={Platform.OS === 'android'}
            >
              <Text style={styles.label}>Why you liked it</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe what stood out..."
                placeholderTextColor={colors.placeholderText}
                value={whyLiked}
                onChangeText={setWhyLiked}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Construction quality</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. excellent draw, even burn..."
                placeholderTextColor={colors.placeholderText}
                value={constructionQuality}
                onChangeText={setConstructionQuality}
                multiline
                numberOfLines={2}
              />

              <DatePickerField
                label="When you smoked it"
                value={smokedDate}
                onChange={setSmokedDate}
                placeholder="Tap to pick date"
                optional={true}
              />
            </ScrollView>

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
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
    maxHeight: '85%',
    paddingBottom: 34,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 320,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.screenBg,
  },
});
