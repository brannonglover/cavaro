import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sendFeedback } from '../api/feedback';
import colors from '../theme/colors';

const FEEDBACK_TYPES = [
  { label: 'General thought', value: 'General' },
  { label: 'Idea', value: 'Idea' },
  { label: 'Bug or issue', value: 'Bug/Issue' },
  { label: 'Feature request', value: 'Feature Request' },
];

export default function FeedbackModal({ visible, onClose }) {
  const [type, setType] = useState('General');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = message?.trim();
    if (!trimmed) {
      Alert.alert('Message required', 'Please enter your feedback.');
      return;
    }

    setSending(true);
    try {
      await sendFeedback({ type, message: trimmed });
      setMessage('');
      setType('General');
      onClose();
      Alert.alert('Thanks!', 'Your feedback has been sent.');
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Please try again later.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Send feedback</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Share your thoughts, ideas, or report issues. We read everything.
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {FEEDBACK_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={styles.input}
              placeholder="Tell us what's on your mind..."
              placeholderTextColor={colors.placeholderText}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              editable={!sending}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={sending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendBtn, (!message?.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!message?.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 20,
  },
  scroll: {
    maxHeight: 360,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.screenBg,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  typeChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.screenBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  sendText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
