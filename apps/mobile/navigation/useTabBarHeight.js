import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

export function useTabBarHeight() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}
