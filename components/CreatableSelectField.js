import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';

const MAX_SUGGESTIONS = 20;

/**
 * Text field with filtered suggestions from known values.
 * User can pick a suggestion or type a new value freely.
 */
export default function CreatableSelectField({
  label,
  value,
  onChangeText,
  options = [],
  placeholder,
  zIndex = 1,
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const trimmedValue = (value || '').trim();

  const filtered = useMemo(() => {
    const query = trimmedValue.toLowerCase();
    if (!query) return options.slice(0, MAX_SUGGESTIONS);
    return options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [trimmedValue, options]);

  const hasExactMatch = useMemo(
    () => options.some((option) => option.toLowerCase() === trimmedValue.toLowerCase()),
    [options, trimmedValue]
  );

  const showUseCustom = focused && trimmedValue && !hasExactMatch;
  const showSuggestions = focused && (filtered.length > 0 || showUseCustom);
  const isOpen = showSuggestions;

  function selectValue(nextValue) {
    onChangeText(nextValue);
    setFocused(false);
  }

  function toggleDropdown() {
    if (focused) {
      inputRef.current?.blur();
      setFocused(false);
    } else {
      inputRef.current?.focus();
    }
  }

  return (
    <View style={[styles.field, { zIndex }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <View style={[styles.inputWrapper, isOpen && styles.inputWrapperOpen]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholderText}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            returnKeyType="done"
            autoCapitalize="words"
          />
          <Pressable
            onPress={toggleDropdown}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            style={styles.chevronButton}
          >
            <MaterialCommunityIcons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        {showSuggestions ? (
          <View style={styles.suggestions}>
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsHeaderText}>Suggestions</Text>
            </View>
            <ScrollView
              style={styles.suggestionsList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((item, index) => (
                <Pressable
                  key={item}
                  style={[
                    styles.suggestionItem,
                    index === filtered.length - 1 && !showUseCustom && styles.suggestionItemLast,
                  ]}
                  onPress={() => selectValue(item)}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
              {showUseCustom ? (
                <Pressable
                  style={[styles.suggestionItem, styles.customSuggestionItem]}
                  onPress={() => selectValue(trimmedValue)}
                >
                  <Text style={styles.customSuggestionText}>Use "{trimmedValue}"</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
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
  inputContainer: {
    position: 'relative',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  inputWrapperOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: colors.borderLight,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 8,
    fontSize: 17,
    color: colors.textPrimary,
  },
  chevronButton: {
    marginRight: 12,
    paddingLeft: 4,
  },
  suggestions: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestionsHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  customSuggestionItem: {
    borderBottomWidth: 0,
  },
  customSuggestionText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '500',
  },
});
