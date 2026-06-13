import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import colors from '../theme/colors';
import { restoreSubscription } from '../api/subscription';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import RestoreSubscriptionResultModal, {
  getRestoreSubscriptionAlert,
} from '../components/RestoreSubscriptionResultModal';

export default function Login({ supabase, onSuccess, onBack, restoreAfterSignIn }) {
  const { refreshTier } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoreAlert, setRestoreAlert] = useState(null);

  const handleLogin = async () => {
    const e = email.trim();
    const p = password;
    if (!e || !p) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    if (!supabase) {
      Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      if (error) throw error;
      trackEvent('login_success');
      if (restoreAfterSignIn) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const result = await restoreSubscription(session.access_token);
          refreshTier?.();
          const alert = getRestoreSubscriptionAlert(result);
          if (alert) setRestoreAlert(alert);
        }
      }
      onSuccess?.();
    } catch (err) {
      Alert.alert('Sign in failed', err.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <RestoreSubscriptionResultModal
        alert={restoreAlert}
        onClose={() => setRestoreAlert(null)}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Welcome back</Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.placeholderText}
              value={email}
              onChangeText={setEmail}
              textContentType="username"
              autoComplete="username"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              editable={!loading}
              returnKeyType="next"
            />
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.placeholderText}
              value={password}
              onChangeText={setPassword}
              textContentType="password"
              autoComplete="password"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              secureTextEntry
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputWrap: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
