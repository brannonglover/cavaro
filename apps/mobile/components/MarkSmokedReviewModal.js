import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DatePickerField, { getTodayDateString } from './DatePickerField';
import { GoldButton } from './ui';
import {
  BURN_OPTIONS,
  DRAW_OPTIONS,
  FINISH_OPTIONS,
  JOURNAL_RATING_MAX,
  STRENGTH_FEEDBACK_OPTIONS,
  SUGGESTED_FLAVOR_TAGS,
} from '../models/journal';
import { borderRadius, colors, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function OptionChips({ label, options, value, onChange }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(active ? undefined : option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FlavorTagPicker({ label, tags, selected, onToggle, variant = 'liked' }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {tags.map((tag) => {
          const active = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[
                styles.chip,
                active && (variant === 'liked' ? styles.chipLiked : styles.chipDisliked),
              ]}
              onPress={() => onToggle(tag)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MarkSmokedReviewModal({ visible, cigar, onSave, onCancel }) {
  const [smokedDate, setSmokedDate] = useState(getTodayDateString());
  const [rating, setRating] = useState('');
  const [wouldBuyAgain, setWouldBuyAgain] = useState(undefined);
  const [likedFlavors, setLikedFlavors] = useState([]);
  const [dislikedFlavors, setDislikedFlavors] = useState([]);
  const [strengthFeedback, setStrengthFeedback] = useState(undefined);
  const [draw, setDraw] = useState(undefined);
  const [burn, setBurn] = useState(undefined);
  const [finish, setFinish] = useState(undefined);
  const [notes, setNotes] = useState('');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!visible) return;
    setSmokedDate(getTodayDateString());
    setRating('');
    setWouldBuyAgain(undefined);
    setLikedFlavors([]);
    setDislikedFlavors([]);
    setStrengthFeedback(undefined);
    setDraw(undefined);
    setBurn(undefined);
    setFinish(undefined);
    setNotes('');
  }, [visible, cigar?.id]);

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

  const toggleLikedFlavor = (tag) => {
    setLikedFlavors((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      setDislikedFlavors((disliked) => disliked.filter((item) => item !== tag));
      return [...prev, tag];
    });
  };

  const toggleDislikedFlavor = (tag) => {
    setDislikedFlavors((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      setLikedFlavors((liked) => liked.filter((item) => item !== tag));
      return [...prev, tag];
    });
  };

  const handleSave = () => {
    const parsedRating = rating.trim() ? Number(rating) : undefined;
    if (parsedRating != null && (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > JOURNAL_RATING_MAX)) {
      Alert.alert('Invalid rating', `Enter a rating between 0 and ${JOURNAL_RATING_MAX}.`);
      return;
    }

    handleClose(() =>
      onSave({
        smokedDate: smokedDate.trim() || getTodayDateString(),
        rating: parsedRating,
        wouldBuyAgain,
        likedFlavors,
        dislikedFlavors,
        strengthFeedback,
        draw,
        burn,
        finish,
        notes: notes.trim() || undefined,
        smokedFromHumidorItemId: cigar?.id != null ? String(cigar.id) : undefined,
      })
    );
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.title}>Mark as smoked</Text>
              <Text style={styles.subtitle}>{cigarLabel}</Text>
              <Text style={styles.hint}>
                Inventory will decrease by one. Capture your tasting notes for the journal.
              </Text>

              <DatePickerField
                label="When did you smoke it?"
                value={smokedDate}
                onChange={setSmokedDate}
                placeholder="Tap to pick date"
                optional={false}
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Rating (0–100)</Text>
                <TextInput
                  value={rating}
                  onChangeText={setRating}
                  keyboardType="number-pad"
                  placeholder="e.g. 88"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
                <View style={styles.chipRow}>
                  {[85, 90, 95].map((preset) => (
                    <Pressable
                      key={preset}
                      style={[styles.chip, rating === String(preset) && styles.chipActive]}
                      onPress={() => setRating(String(preset))}
                    >
                      <Text style={styles.chipText}>{preset}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Would buy again?</Text>
                <View style={styles.chipRow}>
                  {[
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                  ].map(({ label, value }) => {
                    const active = wouldBuyAgain === value;
                    return (
                      <Pressable
                        key={label}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setWouldBuyAgain(active ? undefined : value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <FlavorTagPicker
                label="Flavors you liked"
                tags={SUGGESTED_FLAVOR_TAGS}
                selected={likedFlavors}
                onToggle={toggleLikedFlavor}
                variant="liked"
              />
              <FlavorTagPicker
                label="Flavors you disliked"
                tags={SUGGESTED_FLAVOR_TAGS}
                selected={dislikedFlavors}
                onToggle={toggleDislikedFlavor}
                variant="disliked"
              />

              <OptionChips
                label="Strength"
                options={STRENGTH_FEEDBACK_OPTIONS}
                value={strengthFeedback}
                onChange={setStrengthFeedback}
              />
              <OptionChips label="Draw" options={DRAW_OPTIONS} value={draw} onChange={setDraw} />
              <OptionChips label="Burn" options={BURN_OPTIONS} value={burn} onChange={setBurn} />
              <OptionChips label="Finish" options={FINISH_OPTIONS} value={finish} onChange={setFinish} />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional tasting notes"
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.input, styles.notesInput]}
                  multiline
                />
              </View>

              <View style={styles.actions}>
                <GoldButton
                  title="Cancel"
                  variant="secondary"
                  onPress={() => handleClose(onCancel)}
                  style={styles.actionButton}
                />
                <GoldButton title="Save entry" onPress={handleSave} style={styles.actionButton} />
              </View>
            </ScrollView>
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
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  scrollContent: {
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
  fieldBlock: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceWarm,
  },
  chipLiked: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceWarm,
  },
  chipDisliked: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.gold,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
