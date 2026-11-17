import { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { hapticSelection } from '../lib/haptics';
import { colors } from '../theme';

const INDICATOR_WIDTH = 20;
const BAR_PADDING_X = 8;
const IS_IOS = Platform.OS === 'ios';

/**
 * Frosted, edge-to-edge tab bar that floats over screen content.
 * Screens read its measured height from BottomTabBarHeightContext
 * (via useTabBarHeight) to pad their scroll content clear of it.
 */
export default function CavaroTabBar({ state, descriptors, navigation, insets }) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const [rowWidth, setRowWidth] = useState(0);
  const keyboardVisible = useAndroidKeyboardVisible();
  const indicatorX = useRef(new Animated.Value(0)).current;
  const hasPositioned = useRef(false);

  const tabWidth = rowWidth / state.routes.length;

  useEffect(() => {
    if (!tabWidth) return;
    const target = state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2;
    if (!hasPositioned.current) {
      indicatorX.setValue(target);
      hasPositioned.current = true;
      return;
    }
    Animated.spring(indicatorX, {
      toValue: target,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [state.index, tabWidth, indicatorX]);

  if (keyboardVisible) return null;

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      {IS_IOS ? (
        <BlurView intensity={60} tint="dark" style={styles.blur} />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
      <View pointerEvents="none" style={styles.hairline} />

      <View
        style={styles.row}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        accessibilityRole="tablist"
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const color = focused ? colors.gold : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused) hapticSelection();
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text
                style={[styles.label, { color }, focused && styles.labelFocused]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Android resizes the window for the keyboard, which would lift the bar
// above it; iOS overlays the keyboard, so the bar can stay put.
function useAndroidKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (IS_IOS) return undefined;
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: BAR_PADDING_X,
    overflow: 'hidden',
  },
  blur: {
    // Overscan past the screen edges so the blur doesn't darken at the sides.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -24,
    right: -24,
  },
  tint: {
    // Warm the cool system blur toward the lounge palette; Android has no
    // blur, so it gets a denser tint to stay legible over content.
    backgroundColor: IS_IOS ? 'rgba(13, 11, 9, 0.55)' : 'rgba(13, 11, 9, 0.94)',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200, 164, 93, 0.22)',
  },
  row: {
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: -10,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  tabPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelFocused: {
    fontWeight: '600',
  },
});
