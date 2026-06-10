import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { trackEvent } from '../lib/analytics';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import ForgotPassword from '../pages/ForgotPassword';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function AuthStack({ onAuthenticated }) {
  const { supabase } = useAuth();
  const [signupTier, setSignupTier] = useState('free');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    >
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
            onSuccess={onAuthenticated}
            onBack={() => navigation.goBack()}
            onGoToLogin={() => navigation.navigate('Login')}
            onGoToForgotPassword={(email) => navigation.navigate('ForgotPassword', { email })}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
