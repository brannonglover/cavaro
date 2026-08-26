import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import ConfirmModal from './ConfirmModal';
import FeedbackModal from './FeedbackModal';
import { useAuth } from '../context/AuthContext';
import { deleteAccount } from '../api/user';
import { wipeLocalUserData } from '../db';
import { trackEvent } from '../lib/analytics';

const DROPDOWN_WIDTH = 188;
const DROPDOWN_PADDING = 8;

export default function AccountMenu({ onSignOut, children, triggerStyle }) {
  const { supabase } = useAuth();
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** null | 1 (first warning) | 2 (final confirm) */
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const triggerRef = useRef(null);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPosition({ x, y, width, height });
      setVisible(true);
    });
  };

  const close = () => setVisible(false);

  const handleSignOut = () => {
    close();
    onSignOut?.();
  };

  const runDeleteAccount = async () => {
    setDeleteConfirmStep(null);
    if (!supabase) {
      setDeleteError('Sign in is not configured.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setDeleteError('Sign in again, then try deleting your account.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(session.access_token);
      try {
        await wipeLocalUserData();
      } catch {
        // Account is already removed; local wipe is best-effort.
      }
      trackEvent('account_deleted');
      await supabase.auth.signOut();
    } catch (err) {
      setDeleteError(
        err.message || 'Check your connection and try again. If this continues, contact support.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    close();
    setDeleteConfirmStep(1);
  };

  const openFeedback = () => {
    close();
    setFeedbackVisible(true);
  };

  const screenWidth = Dimensions.get('window').width;
  const dropdownLeft = Math.min(
    Math.max(position.x + position.width - DROPDOWN_WIDTH, DROPDOWN_PADDING),
    screenWidth - DROPDOWN_WIDTH - DROPDOWN_PADDING
  );
  const dropdownTop = position.y + position.height + 4;

  return (
    <>
      <ConfirmModal
        visible={deleteConfirmStep === 1}
        title="Delete your account?"
        message={
          'This permanently removes your Cavaro account, subscription, community reviews linked to it, and clears this device\'s collection. This cannot be undone.'
        }
        variant="warning"
        onClose={() => setDeleteConfirmStep(null)}
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setDeleteConfirmStep(null) },
          {
            text: 'Continue',
            style: 'default',
            onPress: () => setDeleteConfirmStep(2),
          },
        ]}
      />
      <ConfirmModal
        visible={deleteConfirmStep === 2}
        title="Delete account permanently?"
        message="Your account and server data will be deleted now."
        variant="warning"
        onClose={() => setDeleteConfirmStep(null)}
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setDeleteConfirmStep(null) },
          {
            text: 'Delete account',
            style: 'destructive',
            onPress: () => void runDeleteAccount(),
          },
        ]}
      />
      <ConfirmModal
        visible={!!deleteError}
        title="Could not delete account"
        message={deleteError || ''}
        variant="warning"
        onClose={() => setDeleteError(null)}
        buttons={[
          {
            text: 'OK',
            style: 'cancel',
            onPress: () => setDeleteError(null),
          },
        ]}
      />
      <Modal visible={deleting} transparent animationType="fade">
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color={colors.textSecondary} />
        </View>
      </Modal>
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />
      <Pressable ref={triggerRef} onPress={open} style={[styles.trigger, triggerStyle]}>
        {children}
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <View
            style={[
              styles.dropdown,
              {
                left: dropdownLeft,
                top: dropdownTop,
              },
            ]}
          >
            <Pressable
              style={styles.menuItem}
              onPress={openFeedback}
              disabled={deleting}
              android_ripple={{ color: colors.borderLight }}
            >
              <MaterialCommunityIcons
                name="message-text-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.menuIcon}
              />
              <Text style={styles.menuItemText}>Send feedback</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={handleSignOut}
              disabled={deleting}
              android_ripple={{ color: colors.borderLight }}
            >
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color={colors.dislike}
                style={styles.menuIcon}
              />
              <Text style={styles.menuItemTextDestructive}>Sign out</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={confirmDeleteAccount}
              disabled={deleting}
              android_ripple={{ color: colors.borderLight }}
            >
              <MaterialCommunityIcons
                name="account-remove"
                size={20}
                color={colors.dislike}
                style={styles.menuIcon}
              />
              <Text style={styles.menuItemTextDestructive}>Delete account</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 8,
  },
  deletingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    width: DROPDOWN_WIDTH,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuItemTextDestructive: {
    fontSize: 16,
    color: colors.dislike,
    fontWeight: '500',
  },
});
