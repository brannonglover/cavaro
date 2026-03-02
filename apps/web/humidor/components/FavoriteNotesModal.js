import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import colors from '../theme/colors';

export default function FavoriteNotesModal({
  visible,
  cigar,
  initialNotes = {},
  onSave,
  onCancel,
}) {
  const [whyLiked, setWhyLiked] = useState('');
  const [flavorProfile, setFlavorProfile] = useState('');
  const [constructionQuality, setConstructionQuality] = useState('');
  const [smokedDate, setSmokedDate] = useState('');
  const [flavorChanges, setFlavorChanges] = useState('');

  useEffect(() => {
    if (visible) {
      setWhyLiked(initialNotes.favorite_notes ?? '');
      setFlavorProfile(initialNotes.flavor_profile ?? '');
      setConstructionQuality(initialNotes.construction_quality ?? '');
      setSmokedDate(initialNotes.smoked_date ?? '');
      setFlavorChanges(initialNotes.flavor_changes ?? '');
    }
  }, [visible, initialNotes]);

  const handleSave = () => {
    onSave({
      favorite_notes: whyLiked.trim(),
      flavor_profile: flavorProfile.trim(),
      construction_quality: constructionQuality.trim(),
      smoked_date: smokedDate.trim(),
      flavor_changes: flavorChanges.trim(),
    });
  };

  if (!cigar) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Why did you like this cigar?</Text>
          <Text style={styles.subtitle}>
            {cigar.brand ?? ''} · {cigar.name ?? ''}
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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

            <Text style={styles.label}>Flavor profile</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. earthy, woody, hints of pepper..."
              placeholderTextColor={colors.placeholderText}
              value={flavorProfile}
              onChangeText={setFlavorProfile}
              multiline
              numberOfLines={2}
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

            <Text style={styles.label}>When you smoked it</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. March 2024, after dinner..."
              placeholderTextColor={colors.placeholderText}
              value={smokedDate}
              onChangeText={setSmokedDate}
            />

            <Text style={styles.label}>Flavor changes</Text>
            <TextInput
              style={styles.input}
              placeholder="How did flavors evolve over the smoke?"
              placeholderTextColor={colors.placeholderText}
              value={flavorChanges}
              onChangeText={setFlavorChanges}
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
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
    maxHeight: 360,
    paddingHorizontal: 20,
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
