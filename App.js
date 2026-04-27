import 'expo-dev-client';
import { useEffect, useState } from 'react';
import { Linking, View, StyleSheet, Text, Image, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainerWithAnalytics } from './components/NavigationAnalytics';
import { ActionButtons } from './components/ActionButtons';
import KeyboardAccessory from './components/KeyboardAccessory';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthStack from './navigation/AuthStack';
import { ClickOutsideProvider } from 'react-native-click-outside';
import { initDatabase } from './db';
import IapSubscriptionBridge from './components/IapSubscriptionBridge';

SplashScreen.preventAutoHideAsync().catch(() => {});

const FADE_DURATION = 500;
SplashScreen.setOptions({ fade: true, duration: FADE_DURATION });

// Show auth flow (landing, login, signup) when Supabase URL is set.
// Anon key also required for sign up/login to work.
const showAuthFlow = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

const SLOW_LOAD_THRESHOLD_MS = 1500;

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('Database init timed out after 15s - rendering anyway');
      setIsReady(true);
    }, 15000);

    initDatabase()
      .then(() => {
        clearTimeout(timeout);
        setIsReady(true);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('Failed to initialize database:', err);
        setIsReady(true);
      });
  }, []);

  const isLoading = !isReady || (showAuthFlow && authLoading);

  // After a delay, show "Loading..." for slow connections (keeps native splash for fast loads)
  useEffect(() => {
    if (!isLoading) {
      setShowLoadingMessage(false);
      return;
    }
    const t = setTimeout(() => setShowLoadingMessage(true), SLOW_LOAD_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Hide native splash when app is ready, or when we show our custom loading screen
  useEffect(() => {
    if (!isLoading || showLoadingMessage) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, showLoadingMessage]);

  const renderAppContent = () => {
    if (!showAuthFlow) {
      return (
        <View style={styles.appRoot}>
          <NavigationContainerWithAnalytics>
            <ActionButtons />
          </NavigationContainerWithAnalytics>
        </View>
      );
    }
    if (!user) {
      return (
        <NavigationContainerWithAnalytics>
          <AuthStack onAuthenticated={() => {}} />
        </NavigationContainerWithAnalytics>
      );
    }
    return (
      <View style={styles.appRoot}>
        <NavigationContainerWithAnalytics>
          <ActionButtons />
        </NavigationContainerWithAnalytics>
      </View>
    );
  };

  if (isLoading && showLoadingMessage) {
    return (
      <View style={styles.loadingScreen}>
        <Image
          source={require('./assets/logo-wd.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#c4a574" style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isLoading) {
    return null;
  }

  return <View style={styles.appRoot}>{renderAppContent()}</View>;
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#1a1512',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 200,
    height: 200,
  },
  loadingSpinner: {
    marginTop: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
});

function createSessionFromAuthUrl(url, supabase) {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.substring(hashIndex + 1) : '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !supabase) return null;
  return supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || '',
  });
}

/** Email magic-link / OAuth: cavaro://...#access_token=... */
function AuthDeepLinkHandler() {
  const { supabase } = useAuth();

  useEffect(() => {
    const handleIncomingUrl = async (url) => {
      if (!url || !supabase) return;
      if (url.includes('access_token')) {
        try {
          await createSessionFromAuthUrl(url, supabase);
        } catch (e) {
          console.warn('Auth callback error:', e);
        }
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    Linking.getInitialURL().then(handleIncomingUrl);
    return () => sub.remove();
  }, [supabase]);

  return null;
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <KeyboardAccessory />
      <AuthProvider>
        <AuthDeepLinkHandler />
        <IapSubscriptionBridge />
        <ClickOutsideProvider>
          <AppContent />
        </ClickOutsideProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default App;
