import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { getOverallStrength } from '../lib/strength';

export { getOverallStrength } from '../lib/strength';

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
