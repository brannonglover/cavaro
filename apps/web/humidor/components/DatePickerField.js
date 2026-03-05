import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';

function toDateString(d) {
  // Use local date - picker returns UTC midnight; timeZoneOffsetInMinutes makes it local-aware
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateString(str) {
  const parts = str.trim().split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export function getTodayDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/**
 * A pressable field that opens the native date picker.
 * @param {string} value - ISO date string (YYYY-MM-DD) or empty
 * @param {function} onChange - (isoDateStr) => void, receives YYYY-MM-DD or '' when cleared
 * @param {string} label - Field label
 * @param {string} placeholder - Shown when no date selected
 * @param {boolean} optional - If true, show a "Clear" option when date is set
 */
export default function DatePickerField({ value, onChange, label, placeholder = 'Tap to pick date', optional = true }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(null);

  const today = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  })();
  const dateObj = value && value.trim()
    ? (parseDateString(value) ?? today)
    : today;

  const displayText = value && value.trim()
    ? (() => {
        const d = parseDateString(value);
        return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : placeholder;
      })()
    : placeholder;

  const openPicker = () => {
    setPickerDate(dateObj);
    setShowPicker(true);
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set') {
      setPickerDate(selectedDate);
      onChange(toDateString(selectedDate));
    }
  };

  const handleClear = (e) => {
    e?.stopPropagation?.();
    onChange('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.input}
          onPress={openPicker}
        >
          <MaterialCommunityIcons name="calendar" size={22} color={colors.primary} style={styles.calendarIcon} />
          <Text style={[styles.inputText, !value?.trim() && styles.placeholderText]}>
            {displayText}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
        </Pressable>
        {optional && value?.trim() && (
          <Pressable onPress={handleClear} style={styles.clearBtn} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>
      {showPicker && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={pickerDate ?? dateObj}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            timeZoneOffsetInMinutes={-new Date().getTimezoneOffset()}
            themeVariant="dark"
          />
        </View>
      )}
      {Platform.OS === 'ios' && showPicker && (
        <View style={styles.iosPickerActions}>
          <Pressable
            onPress={() => {
              // Use pickerDate (tracks scroll changes) or dateObj (initial) when user taps Done without scrolling
              const dateToSave = pickerDate ?? dateObj;
              onChange(toDateString(dateToSave));
              setShowPicker(false);
            }}
            style={styles.iosPickerBtn}
          >
            <Text style={styles.iosPickerBtnText}>Done</Text>
          </Pressable>
        </View>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  calendarIcon: {
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.placeholderText,
  },
  pickerContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearText: {
    fontSize: 15,
    color: colors.dislike,
    fontWeight: '600',
  },
  iosPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  iosPickerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  iosPickerBtnText: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '600',
  },
});
