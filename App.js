import 'expo-dev-client';
import { useEffect, useState } from 'react';
import { Linking, View, StyleSheet, Text, Image, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainerWithAnalytics } from './components/NavigationAnalytics';
import MainTabs from './navigation/MainTabs';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthStack from './navigation/AuthStack';
import { initDatabase } from './db';
import { restoreAllUserDataOnLogin, pushAllUserData } from './lib/userCigarsSync';
import IapSubscriptionBridge from './components/IapSubscriptionBridge';
import ResetPassword from './pages/ResetPassword';
import UpgradeToPremiumModal from './components/UpgradeToPremiumModal';
import { AUTH_CALLBACK_APP_URL } from './constants/authUrls';
import { colors } from './theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const FADE_DURATION = 500;
SplashScreen.setOptions({ fade: true, duration: FADE_DURATION });

// Show auth flow (landing, login, signup) when Supabase URL is set.
// Anon key also required for sign up/login to work.
const showAuthFlow = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

const SLOW_LOAD_THRESHOLD_MS = 1500;

/** After premium signup, prompt IAP only once Cavaro account exists (Password AutoFill runs on Signup). */
function PostSignupPremiumPrompt() {
  const {
    user,
    supabase,
    tier,
    refreshTier,
    pendingPremiumSubscribe,
    clearPendingPremiumSubscribe,
  } = useAuth();
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    if (!pendingPremiumSubscribe || !supabase) {
      setAccessToken(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, [pendingPremiumSubscribe, supabase, user?.id]);

  if (!pendingPremiumSubscribe || !user || !accessToken) return null;

  return (
    <UpgradeToPremiumModal
      visible
      message="Your Cavaro account is ready. Tap Subscribe to unlock Premium for $2.99/mo. The next step uses your Apple ID for App Store billing—not your Cavaro password."
      onClose={clearPendingPremiumSubscribe}
      accessToken={accessToken}
      userId={user.id}
      tier={tier}
      refreshTier={refreshTier}
    />
  );
}

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const { user, loading: authLoading, needsPasswordReset, supabase, clearPasswordReset } = useAuth();

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('Database init timed out after 15s - rendering anyway');
      setIsReady(true);
    }, 15000);

    initDatabase()
      .then(() => {
        clearTimeout(timeout);
        setIsReady(true);
        if (showAuthFlow && supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.access_token) {
              restoreAllUserDataOnLogin(session.access_token)
                .then(() => pushAllUserData(session.access_token))
                .catch((err) => {
                  console.warn('User data sync failed:', err.message || err);
                });
            }
          });
        }
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
            <MainTabs />
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
    if (needsPasswordReset) {
      return (
        <ResetPassword
          supabase={supabase}
          onComplete={clearPasswordReset}
        />
      );
    }
    return (
      <View style={styles.appRoot}>
        <NavigationContainerWithAnalytics>
          <MainTabs />
        </NavigationContainerWithAnalytics>
        <PostSignupPremiumPrompt />
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
    width: 280,
    height: 170,
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
  const queryIndex = url.indexOf('?');
  const paramString = hashIndex >= 0
    ? url.substring(hashIndex + 1)
    : queryIndex >= 0
      ? url.substring(queryIndex + 1)
      : '';
  const params = new URLSearchParams(paramString);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !supabase) return null;
  return supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || '',
  });
}

/** Email magic-link / OAuth / password recovery: cavaro://auth/callback#access_token=... */
function AuthDeepLinkHandler() {
  const { supabase } = useAuth();

  useEffect(() => {
    const handleIncomingUrl = async (url) => {
      if (!url || !supabase) return;
      const isAuthCallback =
        url.includes('access_token') ||
        url.startsWith(`${AUTH_CALLBACK_APP_URL}`);
      if (!isAuthCallback) return;
      try {
        await createSessionFromAuthUrl(url, supabase);
      } catch (e) {
        console.warn('Auth callback error:', e);
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
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <AuthProvider>
          <AuthDeepLinkHandler />
          <IapSubscriptionBridge />
          <AppContent />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default App;
