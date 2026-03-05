import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import colors from '../theme/colors';

/**
 * Computes overall strength (1-5) from strength_profile JSON.
 * Uses rounded average of thirds; 0 = no data.
 */
export function getOverallStrength(strengthProfileJson) {
  if (!strengthProfileJson?.trim()) return 0;
  try {
    const parsed = JSON.parse(strengthProfileJson);
    const thirds = parsed.thirds ?? [];
    const values = thirds.slice(0, 3).map((t) => t.strength ?? 0).filter((v) => v > 0);
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg);
  } catch {
    return 0;
  }
}

/**
 * Compact strength bar (1-5 dots) shown next to notes icon.
 * Tappable to open Strength Profile modal.
 */
export default function StrengthIndicator({ strength, onPress, size = 'small' }) {
  const dotSize = size === 'small' ? 8 : 10;
  const gap = size === 'small' ? 4 : 5;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        pressed && styles.pressed,
      ]}
      hitSlop={8}
    >
      <View style={[styles.bar, { gap }]}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View
            key={n}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
              },
              n <= strength ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {},
  dotFilled: {
    backgroundColor: colors.primary,
  },
  dotEmpty: {
    backgroundColor: colors.textMuted,
    opacity: 0.4,
  },
});
