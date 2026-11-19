import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { trackEvent } from '../lib/analytics';
import Welcome from '../pages/Welcome';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import ForgotPassword from '../pages/ForgotPassword';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function AuthStack({ onAuthenticated }) {
  const { supabase, signupRequested, clearSignupRequested, enterGuestMode } = useAuth();
  const [signupTier, setSignupTier] = useState('free');

  // When guest taps "create account", skip Welcome and go straight to Signup.
  const initialRoute = signupRequested ? 'Signup' : 'Welcome';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    >
      <Stack.Screen name="Welcome">
        {({ navigation }) => (
          <Welcome
            // No onboarding_viewed here: Welcome already fires it on mount, and
            // firing it again on the Explore tap double-counted every guest who
            // got past the first screen. The tap itself is explore_as_guest.
            onExplore={() => {}}
            onSignIn={() => navigation.navigate('Login')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Landing">
        {({ navigation }) => (
          <Landing
            onGetStarted={() => {
              trackEvent('landing_cta', { action: 'get_started' });
              setSignupTier('free');
              navigation.navigate('Signup');
            }}
            onSubscribe={() => {
              trackEvent('landing_cta', { action: 'subscribe' });
              setSignupTier('premium');
              navigation.navigate('Signup');
            }}
            onAlreadyHaveAccount={() => {
              trackEvent('landing_cta', { action: 'already_have_account' });
              navigation.navigate('Login');
            }}
            onRestoreSubscription={() => {
              trackEvent('landing_cta', { action: 'restore_subscription' });
              navigation.navigate('Login', { restoreAfterSignIn: true });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {({ navigation, route }) => (
          <Login
            supabase={supabase}
            onSuccess={onAuthenticated}
            onBack={() => navigation.goBack()}
            restoreAfterSignIn={route.params?.restoreAfterSignIn}
            onGoToSignup={() => navigation.navigate('Signup')}
            onGoToForgotPassword={(email) => navigation.navigate('ForgotPassword', { email })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {({ navigation, route }) => (
          <ForgotPassword
            supabase={supabase}
            initialEmail={route.params?.email ?? ''}
            onBack={() => navigation.navigate('Login')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Signup">
        {({ navigation }) => (
          <Signup
            supabase={supabase}
            tier={signupTier}
            onSuccess={() => {
              clearSignupRequested();
              onAuthenticated?.();
            }}
            onBack={() => {
              trackEvent('signup_abandoned', { tier: signupTier });
              if (signupRequested) {
                clearSignupRequested();
                enterGuestMode();
              } else {
                navigation.goBack();
              }
            }}
            onGoToLogin={() => {
              clearSignupRequested();
              navigation.navigate('Login');
            }}
            onGoToForgotPassword={(email) => navigation.navigate('ForgotPassword', { email })}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
