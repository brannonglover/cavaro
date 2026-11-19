import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import colors from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const OPTIONS = {
  draw: ['tight', 'perfect', 'loose'],
  burnLine: ['even', 'uneven', 'canoeing'],
  ashQuality: ['solid', 'flaky'],
  smokeOutput: ['thin', 'thick clouds'],
};

function OptionPicker({ label, options, value, onChange }) {
  return (
    <View style={styles.optionSection}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(value === opt ? '' : opt)}
            style={[styles.optionChip, value === opt && styles.optionChipActive]}
          >
            <Text style={[styles.optionChipText, value === opt && styles.optionChipTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function PersonalNotesModal({
  visible,
  cigar,
  initialNotes = {},
  onSave,
  onCancel,
}) {
  const parsed = initialNotes.smoke_notes ? (() => {
    try {
      return JSON.parse(initialNotes.smoke_notes);
    } catch {
      return {};
    }
  })() : {};
  const [draw, setDraw] = useState(parsed.draw ?? '');
  const [burnLine, setBurnLine] = useState(parsed.burn_line ?? '');
  const [ashQuality, setAshQuality] = useState(parsed.ash_quality ?? '');
  const [smokeOutput, setSmokeOutput] = useState(parsed.smoke_output ?? '');
  const [relightsNeeded, setRelightsNeeded] = useState(parsed.relights_needed ?? '');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      const p = initialNotes.smoke_notes ? (() => {
        try {
          return JSON.parse(initialNotes.smoke_notes);
        } catch {
          return {};
        }
      })() : {};
      setDraw(p.draw ?? '');
      setBurnLine(p.burn_line ?? '');
      setAshQuality(p.ash_quality ?? '');
      setSmokeOutput(p.smoke_output ?? '');
      setRelightsNeeded(p.relights_needed ?? '');
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
    const smokeNotes = {
      draw: draw || null,
      burn_line: burnLine || null,
      ash_quality: ashQuality || null,
      smoke_output: smokeOutput || null,
      relights_needed: relightsNeeded || null,
    };
    const notes = {
      smoke_notes: JSON.stringify(smokeNotes),
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
            <Text style={styles.title}>Personal Notes</Text>
            <Text style={styles.subtitle}>
              {[cigar.brand, cigar.line, cigar.name].filter(Boolean).join(' · ') || '—'}
            </Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={Platform.OS === 'android'}
            >
              <OptionPicker label="Draw" options={OPTIONS.draw} value={draw} onChange={setDraw} />
              <OptionPicker label="Burn line" options={OPTIONS.burnLine} value={burnLine} onChange={setBurnLine} />
              <OptionPicker label="Ash quality" options={OPTIONS.ashQuality} value={ashQuality} onChange={setAshQuality} />
              <OptionPicker label="Smoke output" options={OPTIONS.smokeOutput} value={smokeOutput} onChange={setSmokeOutput} />

              <View style={styles.optionSection}>
                <Text style={styles.label}>Relights needed</Text>
                <View style={styles.optionRow}>
                  {['yes', 'no'].map((opt) => (
                    <Pressable
                      key={opt}
                      onPress={() => setRelightsNeeded(relightsNeeded === opt ? '' : opt)}
                      style={[styles.optionChip, relightsNeeded === opt && styles.optionChipActive]}
                    >
                      <Text style={[styles.optionChipText, relightsNeeded === opt && styles.optionChipTextActive]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
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
    bottom: 40,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
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
    flexGrow: 1,
    minHeight: 220,
    maxHeight: 550,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  optionSection: {
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.screenBg,
  },
  optionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  optionChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  optionChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
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
    alignItems: 'center',
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
