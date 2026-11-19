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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createHumidor, getHumidors, moveCigarToHumidor } from '../db';
import { GoldButton } from './ui';
import { borderRadius, colors, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MoveCigarModal({
  visible,
  cigar,
  currentHumidorId,
  onMoved,
  onCancel,
}) {
  const [humidors, setHumidors] = useState([]);
  const [newHumidorName, setNewHumidorName] = useState('');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!visible) return;
    getHumidors()
      .then(setHumidors)
      .catch(() => setHumidors([]));
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
    ]).start(() => {
      setNewHumidorName('');
      done?.();
    });
  };

  const handleMove = async (targetHumidorId) => {
    if (!cigar?.id || targetHumidorId === currentHumidorId) {
      handleClose(onCancel);
      return;
    }
    try {
      await moveCigarToHumidor(cigar.id, targetHumidorId);
      handleClose(onMoved);
    } catch (error) {
      Alert.alert('Move failed', error.message || 'Could not move cigar.');
    }
  };

  const handleCreateHumidor = async () => {
    const name = newHumidorName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the new humidor.');
      return;
    }
    try {
      const id = await createHumidor(name);
      setNewHumidorName('');
      const rows = await getHumidors();
      setHumidors(rows);
      await handleMove(id);
    } catch (error) {
      Alert.alert('Could not create humidor', error.message || 'Please try again.');
    }
  };

  if (!cigar) return null;

  const targets = humidors.filter((h) => h.id !== currentHumidorId);
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
            <Text style={styles.title}>Move cigar</Text>
            <Text style={styles.subtitle}>{cigarLabel}</Text>

            {targets.length > 0 ? (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {targets.map((humidor) => (
                  <Pressable
                    key={humidor.id}
                    style={styles.option}
                    onPress={() => handleMove(humidor.id)}
                  >
                    <MaterialCommunityIcons name="archive-outline" size={22} color={colors.gold} />
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>{humidor.name}</Text>
                      <Text style={styles.optionMeta}>
                        {humidor.cigar_count ?? 0} cigars
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSubtle} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>
                Add another humidor to move cigars between storage locations.
              </Text>
            )}

            <Text style={styles.createLabel}>New humidor</Text>
            <TextInput
              value={newHumidorName}
              onChangeText={setNewHumidorName}
              placeholder="Travel Humidor"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
            <GoldButton
              title="Create & move"
              variant="secondary"
              onPress={handleCreateHumidor}
              style={styles.createButton}
            />
            <GoldButton title="Cancel" variant="secondary" onPress={() => handleClose(onCancel)} />
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
    maxHeight: SCREEN_HEIGHT * 0.75,
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
    marginBottom: spacing.lg,
  },
  list: {
    maxHeight: 220,
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  optionMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  createLabel: {
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
    marginBottom: spacing.md,
  },
  createButton: {
    marginBottom: spacing.sm,
  },
});
