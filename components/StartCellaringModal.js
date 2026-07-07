import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { startCellaring } from '../db';
import { hapticSuccess } from '../lib/haptics';
import { GoldButton } from './ui';
import { borderRadius, colors, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PRESET_MONTHS = [6, 12, 18, 24];

export default function StartCellaringModal({
  visible,
  cigar,
  humidorId,
  onSaved,
  onCancel,
}) {
  const [selectedMonths, setSelectedMonths] = useState(12);
  const [customMonths, setCustomMonths] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setSelectedMonths(12);
      setCustomMonths('');
      setUseCustom(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, overlayOpacity, sheetTranslateY]);

  const handleClose = (done) => {
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
    ]).start(() => done?.());
  };

  const resolveTargetMonths = () => {
    if (useCustom) {
      const parsed = parseInt(customMonths, 10);
      if (!parsed || parsed < 1) {
        throw new Error('Enter a valid number of months.');
      }
      return parsed;
    }
    return selectedMonths;
  };

  const handleSave = async () => {
    try {
      const targetMonths = resolveTargetMonths();
      await startCellaring({
        cigarId: cigar.id,
        humidorId,
        targetMonths,
      });
      hapticSuccess();
      handleClose(onSaved);
    } catch (error) {
      Alert.alert('Cellaring failed', error.message || 'Could not start cellaring.');
    }
  };

  if (!cigar) return null;

  const cigarLabel = [cigar.brand, cigar.line, cigar.name].filter(Boolean).join(' · ') || '—';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => handleClose(onCancel)}>
      <GestureHandlerRootView style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handleClose(onCancel)}>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </Pressable>
        <View style={styles.sheetWrapper}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <Text style={styles.title}>Start cellaring</Text>
            <Text style={styles.subtitle}>{cigarLabel}</Text>
            <Text style={styles.hint}>
              Set this cigar aside to age. One stick will move from available inventory.
            </Text>

            <View style={styles.presetRow}>
              {PRESET_MONTHS.map((months) => {
                const active = !useCustom && selectedMonths === months;
                return (
                  <Pressable
                    key={months}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => {
                      setUseCustom(false);
                      setSelectedMonths(months);
                    }}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {months} mo
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.customToggle, useCustom && styles.customToggleActive]}
              onPress={() => setUseCustom(true)}
            >
              <Text style={[styles.customToggleText, useCustom && styles.presetTextActive]}>
                Custom
              </Text>
            </Pressable>
            {useCustom ? (
              <TextInput
                value={customMonths}
                onChangeText={setCustomMonths}
                keyboardType="number-pad"
                placeholder="Months"
                placeholderTextColor={colors.textSubtle}
                style={styles.input}
              />
            ) : null}

            <View style={styles.actions}>
              <GoldButton title="Cancel" variant="secondary" onPress={() => handleClose(onCancel)} style={styles.action} />
              <GoldButton title="Start cellaring" onPress={handleSave} style={styles.action} />
            </View>
          </Animated.View>
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
    backgroundColor: 'rgba(5, 4, 3, 0.72)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    paddingTop: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  presetChip: {
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLight,
  },
  presetChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceWarm,
  },
  presetText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  presetTextActive: {
    color: colors.gold,
  },
  customToggle: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  customToggleActive: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceWarm,
  },
  customToggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
  },
});
