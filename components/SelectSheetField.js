import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '../theme/colors';
import { PressableScale } from './ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ROW_HEIGHT = 52;
const FADE_HEIGHT = 36;

export default function SelectSheetField({
  label,
  value,
  items = [],
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  disabled = false,
  emptyText = 'No options',
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeOpacity = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const scrollMetrics = useRef({ offset: 0, content: 0, layout: 0 });
  const [canScrollMore, setCanScrollMore] = useState(false);

  const updateOverflowHint = useCallback(() => {
    const { offset, content, layout } = scrollMetrics.current;
    const hasOverflow = content > layout + 12;
    const atBottom = offset + layout >= content - 12;
    setCanScrollMore(hasOverflow && !atBottom);
  }, []);

  const selected = items.find((item) => item.value === value);
  const displayText = selected?.label || placeholder;
  const hasValue = !!selected;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      (item.label || item.value || '').toLowerCase().includes(needle)
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      fadeOpacity.setValue(0);
      setCanScrollMore(false);
      scrollMetrics.current = { offset: 0, content: 0, layout: 0 };
      return;
    }
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
    ]).start(({ finished }) => {
      if (!finished) return;
      listRef.current?.flashScrollIndicators?.();
    });
  }, [open, overlayOpacity, sheetTranslateY, fadeOpacity]);

  useEffect(() => {
    Animated.timing(fadeOpacity, {
      toValue: canScrollMore ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [canScrollMore, fadeOpacity]);

  useEffect(() => {
    if (!open || query) return;
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.25,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, items, value, query]);

  const close = (after) => {
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
    ]).start(() => {
      setQuery('');
      setOpen(false);
      after?.();
    });
  };

  const handleSelect = (item) => {
    Haptics.selectionAsync().catch(() => {});
    onChange?.(item.value);
    close();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        accessibilityLabel={label}
      >
        <Text
          style={[styles.triggerText, !hasValue && styles.placeholder, disabled && styles.triggerTextDisabled]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={22}
          color={disabled ? colors.textMuted : colors.textSecondary}
        />
      </PressableScale>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => close()}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()}>
            <Animated.View
              style={[styles.overlay, { opacity: overlayOpacity }]}
              pointerEvents="none"
            />
          </Pressable>
          <KeyboardAvoidingView
            style={styles.sheetWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  paddingBottom: Math.max(insets.bottom, 16),
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
            >
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable onPress={() => close()} hitSlop={12} style={styles.closeBtn}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.placeholderText}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>

              <View style={styles.listWrap}>
                <FlatList
                  ref={listRef}
                  data={filtered}
                  style={styles.list}
                  keyExtractor={(item) => String(item.value)}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator
                  indicatorStyle="white"
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    scrollMetrics.current.offset = event.nativeEvent.contentOffset.y;
                    updateOverflowHint();
                  }}
                  onContentSizeChange={(_width, height) => {
                    scrollMetrics.current.content = height;
                    updateOverflowHint();
                  }}
                  onLayout={(event) => {
                    scrollMetrics.current.layout = event.nativeEvent.layout.height;
                    updateOverflowHint();
                  }}
                  getItemLayout={(_, index) => ({
                    length: ROW_HEIGHT,
                    offset: ROW_HEIGHT * index,
                    index,
                  })}
                  onScrollToIndexFailed={({ index }) => {
                    setTimeout(() => {
                      listRef.current?.scrollToIndex({
                        index,
                        viewPosition: 0.25,
                        animated: false,
                      });
                    }, 80);
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      {query.trim() ? 'No matches' : emptyText}
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <Pressable
                        onPress={() => handleSelect(item)}
                        style={({ pressed }) => [
                          styles.row,
                          isSelected && styles.rowSelected,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text
                          style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {isSelected ? (
                          <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  }}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.listFade, { opacity: fadeOpacity, backgroundColor: colors.cardBg }]}
                />
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerDisabled: {
    opacity: 0.55,
  },
  triggerText: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
    marginRight: 8,
  },
  triggerTextDisabled: {
    color: colors.textMuted,
  },
  placeholder: {
    color: colors.placeholderText,
  },
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
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    height: SCREEN_HEIGHT * 0.68,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingLeft: 12,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: colors.textPrimary,
  },
  list: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  listFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowSelected: {
    backgroundColor: 'transparent',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
    marginRight: 12,
  },
  rowLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 15,
    paddingVertical: 28,
  },
});
