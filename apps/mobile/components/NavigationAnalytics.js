import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useNavigationContainerRef } from '@react-navigation/native';
import { trackScreen } from '../lib/analytics';
import { cavaroNavigationTheme } from '../theme';

/**
 * NavigationContainer with automatic screen view tracking.
 * Tracks tab switches (Home, Humidors, Collection, MyTaste, Journal)
 * and stack screens (CavaroList, AddCigar, EditCigar, Landing, Login, Signup).
 */
export function NavigationContainerWithAnalytics({ children, ...props }) {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef(null);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={cavaroNavigationTheme}
      onReady={() => {
        const currentRoute = navigationRef.current?.getCurrentRoute?.();
        if (currentRoute?.name) {
          routeNameRef.current = currentRoute.name;
          trackScreen(currentRoute.name);
        }
      }}
      onStateChange={() => {
        const previousRouteName = routeNameRef.current;
        const currentRoute = navigationRef.current?.getCurrentRoute?.();
        const currentRouteName = currentRoute?.name;

        if (currentRouteName && previousRouteName !== currentRouteName) {
          trackScreen(currentRouteName);
          routeNameRef.current = currentRouteName;
        }
      }}
      {...props}
    >
      {children}
    </NavigationContainer>
  );
}
