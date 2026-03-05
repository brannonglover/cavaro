import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';

const STRENGTH_LABELS = ['Mild', 'Mild-Med', 'Medium', 'Med-Full', 'Full'];
const THIRD_LABELS = ['First Third', 'Second Third', 'Final Third'];
const COMMON_FLAVORS = [
  'earthy', 'woody', 'pepper', 'spice', 'leather', 'cocoa',
  'cream', 'nutty', 'coffee', 'sweet', 'floral', 'citrus',
];

const DEFAULT_THIRDS = [
  { strength: 0, flavors: [] },
  { strength: 0, flavors: [] },
  { strength: 0, flavors: [] },
];

function parseStrengthProfile(jsonStr) {
  if (!jsonStr?.trim()) return { thirds: [...DEFAULT_THIRDS] };
  try {
    const parsed = JSON.parse(jsonStr);
    const thirds = (parsed.thirds ?? []).slice(0, 3);
    while (thirds.length < 3) {
      thirds.push({ strength: 0, flavors: [] });
    }
    return { thirds };
  } catch {
    return { thirds: [...DEFAULT_THIRDS] };
  }
}

function StrengthDots({ value, onChange }) {
  return (
    <View style={styles.strengthDots}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={[styles.dot, n <= value && styles.dotFilled]}
        >
          <View style={[styles.dotInner, n <= value && styles.dotInnerFilled]} />
        </Pressable>
      ))}
    </View>
  );
}

function FlavorChips({ selected, onToggle }) {
  const customFlavors = selected.filter((f) => !COMMON_FLAVORS.includes(f));
  const allFlavors = [...COMMON_FLAVORS, ...customFlavors];
  return (
    <View style={styles.flavorChipsWrap}>
      {allFlavors.map((f) => {
        const isSelected = selected.includes(f);
        return (
          <Pressable
            key={f}
            onPress={() => onToggle(f)}
            style={[styles.flavorChip, isSelected && styles.flavorChipSelected]}
          >
            <Text style={[styles.flavorChipText, isSelected && styles.flavorChipTextSelected]}>
              {f}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function StrengthProfileModal({
  visible,
  cigar,
  initialProfile = null,
  onSave,
  onCancel,
}) {
  const [thirds, setThirds] = useState([...DEFAULT_THIRDS]);
  const [customFlavor, setCustomFlavor] = useState('');

  useEffect(() => {
    if (visible) {
      const { thirds: t } = parseStrengthProfile(initialProfile ?? '');
      setThirds(t.map((third) => ({
        strength: third.strength ?? 0,
        flavors: Array.isArray(third.flavors) ? [...third.flavors] : [],
      })));
      setCustomFlavor('');
    }
  }, [visible, initialProfile]);

  const updateThird = (index, field, value) => {
    setThirds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleFlavor = (thirdIndex, flavor) => {
    setThirds((prev) => {
      const next = [...prev];
      const arr = next[thirdIndex].flavors ?? [];
      const idx = arr.indexOf(flavor);
      const nextFlavors = idx >= 0
        ? arr.filter((_, i) => i !== idx)
        : [...arr, flavor];
      next[thirdIndex] = { ...next[thirdIndex], flavors: nextFlavors };
      return next;
    });
  };

  const addCustomFlavor = (thirdIndex) => {
    const f = customFlavor.trim().toLowerCase();
    if (!f) return;
    const arr = thirds[thirdIndex].flavors ?? [];
    if (arr.includes(f)) return;
    updateThird(thirdIndex, 'flavors', [...arr, f]);
    setCustomFlavor('');
  };

  const handleSave = () => {
    onSave({
      thirds: thirds.map((t) => ({
        strength: t.strength,
        flavors: t.flavors ?? [],
      })),
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
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Strength Profile</Text>
          <Text style={styles.subtitle}>
            {cigar.brand ?? ''} · {cigar.name ?? ''}
          </Text>
          <Text style={styles.hint}>
            Document how strength and flavor evolve through the smoke
          </Text>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.thirdBlock}>
                <Text style={styles.thirdLabel}>{THIRD_LABELS[i]}</Text>
                <Text style={styles.strengthLabel}>Strength</Text>
                <StrengthDots
                  value={thirds[i].strength}
                  onChange={(v) => updateThird(i, 'strength', v)}
                />
                <Text style={styles.flavorsLabel}>Flavors</Text>
                <FlavorChips
                  selected={thirds[i].flavors ?? []}
                  onToggle={(f) => toggleFlavor(i, f)}
                />
                <View style={styles.customFlavorRow}>
                  <TextInput
                    style={styles.customFlavorInput}
                    placeholder="Add custom flavor..."
                    placeholderTextColor={colors.placeholderText}
                    value={customFlavor}
                    onChangeText={setCustomFlavor}
                    onSubmitEditing={() => addCustomFlavor(i)}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => addCustomFlavor(i)}
                    style={[styles.addFlavorBtn, !customFlavor.trim() && styles.addFlavorBtnDisabled]}
                    disabled={!customFlavor.trim()}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={colors.cardBg} />
                  </Pressable>
                </View>
              </View>
            ))}
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
      </View>
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
    maxHeight: '90%',
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
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 420,
    paddingHorizontal: 20,
  },
  thirdBlock: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  thirdLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  strengthDots: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: colors.primary,
  },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'transparent',
  },
  dotInnerFilled: {
    backgroundColor: colors.primary,
  },
  flavorsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  flavorChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  flavorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  flavorChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flavorChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  flavorChipTextSelected: {
    color: colors.cardBg,
    fontWeight: '600',
  },
  customFlavorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customFlavorInput: {
    flex: 1,
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  addFlavorBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFlavorBtnDisabled: {
    opacity: 0.5,
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

export { parseStrengthProfile, STRENGTH_LABELS, COMMON_FLAVORS };
