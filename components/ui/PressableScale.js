import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const DEFAULT_SCALE = 0.98;

export default function PressableScale({
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled = false,
  scaleTo = DEFAULT_SCALE,
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
  hitSlop,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 48,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={(event) => {
        animateTo(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
