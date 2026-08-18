import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs';

export function useTabBarHeight() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}
