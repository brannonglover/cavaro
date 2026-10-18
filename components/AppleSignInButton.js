/**
 * Sign in with Apple button.
 *
 * Renders nothing when Apple auth is unavailable (Android, iOS < 13), so callers
 * can drop it in without platform checks. Owns its own loading state and error
 * alert; onDone fires only on a real success.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

/**
 * `intent` is passed through to analytics only — 'signup' from the signup
 * screen and the guest prompt, 'signin' from the login screen. Apple itself
 * does not distinguish the two.
 */
export default function AppleSignInButton({
  label = 'Continue with Apple',
  intent = 'signin',
  disabled,
  onDone,
  style,
}) {
  const { appleAuthAvailable, signInWithApple } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!appleAuthAvailable) return null;

  const handlePress = async () => {
    setBusy(true);
    try {
      const ok = await signInWithApple({ intent });
      if (ok) onDone?.();
    } catch (err) {
      Alert.alert('Sign in failed', err?.message || 'Could not sign in with Apple. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      style={[styles.btn, (disabled || busy) && styles.btnDisabled, style]}
      onPress={handlePress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={styles.content}>
          <MaterialCommunityIcons name="apple" size={22} color="#fff" />
          <Text style={styles.text}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
