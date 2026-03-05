import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeedbackBtn from '../components/FeedbackBtn';
import { getDrinkPairing } from '../api/pairing';
import colors from '../theme/colors';

function Pairing() {
  const [cigar, setCigar] = useState('');
  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGetPairing = async () => {
    const trimmed = cigar.trim();
    if (!trimmed) {
      Alert.alert('Cigar required', 'Please enter the cigar you\'re about to smoke.');
      return;
    }

    setLoading(true);
    setPairing(null);
    try {
      const result = await getDrinkPairing(trimmed);
      setPairing(result);
    } catch (err) {
      Alert.alert('Could not get pairing', err.message || 'Please try again. Make sure the server is running and OPENAI_API_KEY is set.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Drink Pairing</Text>
            <Text style={styles.subtitle}>AI-powered suggestions</Text>
          </View>
          <FeedbackBtn />
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <Text style={styles.label}>What cigar are you about to smoke?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Padrón 1964 Anniversary, Montecristo No. 2..."
            placeholderTextColor={colors.placeholderText}
            value={cigar}
            onChangeText={setCigar}
            editable={!loading}
            autoCapitalize="words"
          />

          <Pressable
            style={[styles.button, (!cigar.trim() || loading) && styles.buttonDisabled]}
            onPress={handleGetPairing}
            disabled={!cigar.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="glass-cocktail" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Get drink pairings</Text>
              </>
            )}
          </Pressable>

          {pairing && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Suggested pairings</Text>
              <ScrollView
                style={styles.resultScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={styles.resultText}>{pairing}</Text>
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export default Pairing;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  resultCard: {
    marginTop: 24,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    flex: 1,
    minHeight: 120,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  resultScroll: {
    flex: 1,
  },
  resultText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
  },
});
