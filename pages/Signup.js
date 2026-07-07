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
    if (!name) {
      Alert.alert('Missing name', 'Please enter your first name.');
      return;
    }
    if (!e || !p) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    if (p.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
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
            data: { first_name: name },
            emailRedirectTo: AUTH_CALLBACK_WEB_URL,
          },
        }
      );
      if (error) {
        if (isDuplicateSignupError(error)) {
          setAlreadyHasAccount(true);
          return;
        }
        throw error;
      }
      if (isDuplicateSignupResponse(data)) {
        setAlreadyHasAccount(true);
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
              ? 'Step 1: Create your Cavaro account. Step 2: Subscribe with your Apple ID for App Store billing.'
              : 'Free tier: up to 5 cigars'}
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="First name"
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
});
