import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import colors from '../theme/colors';

const TAB_ORDER = ['Humidor', 'Favorites', 'Dislikes', 'Pairing'];
const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 400;
const SLIDE_DISTANCE = 24;

/**
 * Wraps tab screen content and adds horizontal swipe gestures to switch between tabs.
 * Swipe left -> next tab, swipe right -> previous tab.
 * Uses instant navigation with a polished slide-in animation on the new screen.
 */
export function SwipeableTabWrapper({ children }) {
  const navigation = useNavigation();
  const translateX = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-25, 25])
        .runOnJS(true)
        .onEnd((event) => {
          const { translationX, velocityX } = event;
          const state = navigation.getState();
          const currentIndex = state?.index ?? 0;
          const currentName = state?.routes?.[currentIndex]?.name;
          if (!currentName || !TAB_ORDER.includes(currentName)) return;

          const isSwipeLeft = translationX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD;
          const isSwipeRight = translationX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD;

          if (isSwipeLeft && currentIndex < TAB_ORDER.length - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(TAB_ORDER[currentIndex + 1]);
          } else if (isSwipeRight && currentIndex > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(TAB_ORDER[currentIndex - 1]);
          }
        }),
    [navigation]
  );

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.screenBg,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
});
