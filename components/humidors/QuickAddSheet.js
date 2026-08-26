import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CavaroButton, PressableScale } from '../ui';
import { borderRadius, colors, radius, spacing, typography } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function HumidorRow({ humidor, busy, disabled, onPress }) {
  const count = humidor.cigar_count ?? 0;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.row, disabled && !busy && styles.rowDisabled]}
      accessibilityLabel={`Add to ${humidor.name}`}
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="treasure-chest" size={18} color={colors.gold} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{humidor.name}</Text>
        <Text style={styles.rowMeta}>
          {count === 1 ? '1 cigar' : `${count} cigars`}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.gold} />
      ) : (
        <MaterialCommunityIcons name="plus-circle-outline" size={22} color={colors.goldMuted} />
      )}
    </PressableScale>
  );
}

/**
 * Bottom sheet for one-tap inventory adds: picks a humidor when the user has
 * more than one, then confirms what was saved.
 */
export default function QuickAddSheet({
  visible,
  mode = 'picker',
  cigarLabel,
  humidors = [],
  confirmation,
  busyHumidorId = null,
  onSelectHumidor,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

  const close = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose?.();
    });
  };

  const isConfirm = mode === 'confirm';
  const busy = busyHumidorId != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </Pressable>
        <View style={styles.sheetWrapper} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, spacing.md),
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.handle} />

            {isConfirm ? (
              <View style={styles.confirm}>
                <View style={styles.confirmIcon}>
                  <MaterialCommunityIcons name="check" size={28} color={colors.gold} />
                </View>
                <Text style={styles.confirmTitle}>
                  {confirmation?.incremented ? 'Quantity updated' : 'Added to your humidor'}
                </Text>
                <Text style={styles.confirmMessage}>
                  {confirmation?.incremented
                    ? `${confirmation?.cigarLabel} is now ${confirmation?.quantity} in ${confirmation?.humidorName}.`
                    : `${confirmation?.cigarLabel} was added to ${confirmation?.humidorName}.`}
                </Text>
                <CavaroButton label="Done" onPress={close} style={styles.confirmBtn} />
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Add to which humidor?</Text>
                  <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                </View>
                {cigarLabel ? (
                  <Text style={styles.subtitle} numberOfLines={2}>{cigarLabel}</Text>
                ) : null}
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                >
                  {humidors.map((humidor) => (
                    <HumidorRow
                      key={humidor.id}
                      humidor={humidor}
                      busy={busyHumidorId === humidor.id}
                      disabled={busy}
                      onPress={() => onSelectHumidor?.(humidor)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 4, 3, 0.72)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    flex: 1,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingLeft: spacing.sm,
  },
  closeText: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  confirm: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: 'center',
  },
  confirmMessage: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  confirmBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
