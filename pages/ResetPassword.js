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

export default function ResetPassword({ supabase, onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const p = password;
    const c = confirmPassword;
    if (p.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (p !== c) {
      Alert.alert('Passwords do not match', 'Please try again.');
      return;
    }
    if (!supabase) {
      Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) throw error;
      Alert.alert('Password updated', 'Your new password is ready. You are signed in.', [
        { text: 'OK', onPress: () => onComplete?.() },
      ]);
    } catch (err) {
      Alert.alert('Update failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your Cavaro account.
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={colors.placeholderText}
              value={password}
              onChangeText={setPassword}
              textContentType="newPassword"
              autoComplete="password-new"
              passwordRules="minlength: 6;"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              secureTextEntry
              editable={!loading}
              returnKeyType="next"
            />
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.placeholderText}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              textContentType="newPassword"
              autoComplete="password-new"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              secureTextEntry
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
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
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
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
