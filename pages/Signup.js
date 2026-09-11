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
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { trackEvent } from '../lib/analytics';
import { AUTH_CALLBACK_WEB_URL } from '../constants/authUrls';
import { useAuth } from '../context/AuthContext';

function isDuplicateSignupError(error) {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  return (
    error.status === 422 ||
    error.code === 'user_already_exists' ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  );
}

function isDuplicateSignupResponse(data) {
  return data?.user != null && (!data.user.identities || data.user.identities.length === 0);
}

export default function Signup({ supabase, tier, onSuccess, onBack, onGoToLogin, onGoToForgotPassword }) {
  const { setPendingPremiumSubscribe } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkEmailFor, setCheckEmailFor] = useState(null);
  const [alreadyHasAccount, setAlreadyHasAccount] = useState(false);

  const handleSignup = async () => {
    const e = email.trim();
    const p = password;
    const name = firstName.trim();
    if (!e || !p) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      trackEvent('signup_failed', { reason: 'missing_fields' });
      return;
    }
    if (p.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      trackEvent('signup_failed', { reason: 'password_too_short' });
      return;
    }
    if (!supabase) {
      Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
      return;
    }
    setLoading(true);
    setAlreadyHasAccount(false);
    try {
      const { data, error } = await supabase.auth.signUp(
        {
          email: e,
          password: p,
          options: {
            data: name ? { first_name: name } : undefined,
            emailRedirectTo: AUTH_CALLBACK_WEB_URL,
          },
        }
      );
      if (error) {
        if (isDuplicateSignupError(error)) {
          setAlreadyHasAccount(true);
          trackEvent('signup_failed', { reason: 'duplicate_account' });
          return;
        }
        throw error;
      }
      if (isDuplicateSignupResponse(data)) {
        setAlreadyHasAccount(true);
        trackEvent('signup_failed', { reason: 'duplicate_account' });
        return;
      }
      trackEvent('signup_success', { tier });
      if (data.session) {
        // User is immediately logged in (email confirmation disabled)
        if (tier === 'premium') {
          setPendingPremiumSubscribe(true);
        }
        onSuccess?.();
      } else {
        // Email confirmation required – show check-your-email screen
        setCheckEmailFor(e);
      }
    } catch (err) {
      trackEvent('signup_failed', { reason: 'error', error: err.message || 'unknown' });
      Alert.alert('Sign up failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkEmailFor) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a confirmation link to {checkEmailFor}. Click the link to verify your account, then come back to sign in.
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => {
                setCheckEmailFor(null);
                (onGoToLogin ?? onBack)?.();
              }}
            >
              <Text style={styles.buttonText}>Go to sign in</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            {tier === 'premium'
              ? 'Create your Cavaro account, then subscribe for Premium.'
              : 'Create a free account to back up your collection.'}
          </Text>

          {Platform.OS === 'ios' && (
            <Pressable
              style={styles.socialBtn}
              onPress={() => {
                trackEvent('guest_signup_method_selected', { method: 'apple' });
                Alert.alert('Coming soon', 'Sign in with Apple will be available in the next update.');
              }}
              disabled={loading}
            >
              <MaterialCommunityIcons name="apple" size={20} color="#fff" />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.socialBtn}
            onPress={() => {
              trackEvent('guest_signup_method_selected', { method: 'google' });
              Alert.alert('Coming soon', 'Sign in with Google will be available in the next update.');
            }}
            disabled={loading}
          >
            <MaterialCommunityIcons name="google" size={20} color="#fff" />
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="First name (optional)"
              placeholderTextColor={colors.placeholderText}
              value={firstName}
              onChangeText={setFirstName}
              textContentType="givenName"
              autoComplete="given-name"
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
              returnKeyType="next"
            />
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.placeholderText}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setAlreadyHasAccount(false);
              }}
              textContentType="emailAddress"
              autoComplete="email"
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
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.placeholderText}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setAlreadyHasAccount(false);
              }}
              textContentType="newPassword"
              autoComplete="password-new"
              passwordRules="minlength: 6;"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              secureTextEntry
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </Pressable>

          {alreadyHasAccount && (
            <View style={styles.alreadyAccountBlock}>
              <Text style={styles.errorText}>You already have an account with us.</Text>
              <Pressable
                style={styles.linkBtn}
                onPress={() => onGoToForgotPassword?.(email.trim())}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>
          )}
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
  container: {
    flex: 1,
    padding: 24,
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
  alreadyAccountBlock: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 15,
    color: colors.warning,
    textAlign: 'center',
  },
  linkBtn: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 15,
    color: colors.primary,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 14,
    marginBottom: 12,
  },
  socialBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginHorizontal: 16,
  },
});
