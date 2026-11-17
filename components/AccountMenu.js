import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import ConfirmModal from './ConfirmModal';
import FeedbackModal from './FeedbackModal';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import getUserFirstName from '../lib/getUserFirstName';
import { pickAvatarImage, takeAvatarPhoto } from '../utils/imagePicker';
import { uploadAvatarImage } from '../api/upload';
import { deleteAccount } from '../api/user';
import { wipeLocalUserData } from '../db';
import { trackEvent } from '../lib/analytics';

// Minimum, not fixed: the labels scale with the reader's Dynamic Type setting,
// and a hard width clipped "Send feedback" and "Delete account" at larger sizes.
// The menu now measures itself and grows, bounded by the screen.
const DROPDOWN_MIN_WIDTH = 188;
const DROPDOWN_PADDING = 8;

export default function AccountMenu({ onSignOut, children, triggerStyle, accessibilityLabel }) {
  const { supabase, user } = useAuth();
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** null | 1 (first warning) | 2 (final confirm) */
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // Actual rendered width, so the menu stays anchored to the trigger as it grows.
  const [menuWidth, setMenuWidth] = useState(DROPDOWN_MIN_WIDTH);
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

  /**
   * Uploads the picked image and stores its URL on the Supabase user.
   *
   * user_metadata is the right home for this: it already carries first_name,
   * it travels with the session so the avatar follows the account onto any
   * device, and it needs no table or endpoint of its own.
   */
  const applyAvatar = async (localUri) => {
    if (!supabase) return;
    setSavingPhoto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setPhotoError('Sign in again, then try changing your photo.');
        return;
      }
      const url = localUri ? await uploadAvatarImage(localUri, session.access_token) : null;
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (error) throw error;
      // Refresh so the header re-renders with the new metadata.
      await supabase.auth.refreshSession();
    } catch (err) {
      setPhotoError(err.message || 'Could not update your photo. Please try again.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const changePhoto = () => {
    close();
    const hasPhoto = !!user?.user_metadata?.avatar_url;
    const options = hasPhoto
      ? ['Take photo', 'Choose from library', 'Remove photo', 'Cancel']
      : ['Take photo', 'Choose from library', 'Cancel'];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = hasPhoto ? 2 : undefined;

    const run = async (index) => {
      if (index === cancelButtonIndex) return;
      if (hasPhoto && index === 2) {
        await applyAvatar(null);
        return;
      }
      const picked = index === 0 ? await takeAvatarPhoto() : await pickAvatarImage();
      if (picked?.error) {
        setPhotoError(picked.error);
        return;
      }
      if (picked?.uri) await applyAvatar(picked.uri);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        (index) => void run(index)
      );
    } else {
      // Android has no action sheet; the two-step alert keeps parity.
      Alert.alert(
        'Profile photo',
        null,
        options.map((text, index) => ({
          text,
          style: index === cancelButtonIndex ? 'cancel' : index === destructiveButtonIndex ? 'destructive' : 'default',
          onPress: () => void run(index),
        }))
      );
    }
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
  const dropdownMaxWidth = screenWidth - DROPDOWN_PADDING * 2;
  const dropdownLeft = Math.min(
    Math.max(position.x + position.width - menuWidth, DROPDOWN_PADDING),
    Math.max(DROPDOWN_PADDING, screenWidth - menuWidth - DROPDOWN_PADDING)
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
      <ConfirmModal
        visible={!!photoError}
        title="Could not update your photo"
        message={photoError || ''}
        variant="warning"
        onClose={() => setPhotoError(null)}
        buttons={[{ text: 'OK', style: 'cancel', onPress: () => setPhotoError(null) }]}
      />
      <Modal visible={deleting || savingPhoto} transparent animationType="fade">
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color={colors.textSecondary} />
        </View>
      </Modal>
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />
      <Pressable
        ref={triggerRef}
        onPress={open}
        style={[styles.trigger, triggerStyle]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
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
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w && w !== menuWidth) setMenuWidth(w);
            }}
            style={[
              styles.dropdown,
              {
                left: dropdownLeft,
                top: dropdownTop,
                maxWidth: dropdownMaxWidth,
              },
            ]}
          >
            <View style={styles.identity}>
              <Avatar user={user} size={40} />
              <View style={styles.identityText}>
                {getUserFirstName(user) ? (
                  <Text style={styles.identityName} numberOfLines={1}>
                    {getUserFirstName(user)}
                  </Text>
                ) : null}
                {user?.email ? (
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
              </View>
            </View>

            <Pressable
              style={styles.menuItem}
              onPress={changePhoto}
              disabled={deleting || savingPhoto}
              android_ripple={{ color: colors.borderLight }}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.menuIcon}
              />
              <Text style={styles.menuItemText} numberOfLines={1}>
                {user?.user_metadata?.avatar_url ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>

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
              <Text style={styles.menuItemText} numberOfLines={1}>Send feedback</Text>
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
              <Text style={styles.menuItemTextDestructive} numberOfLines={1}>Sign out</Text>
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
              <Text style={styles.menuItemTextDestructive} numberOfLines={1}>Delete account</Text>
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
    minWidth: DROPDOWN_MIN_WIDTH,
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  identityText: {
    flexShrink: 1,
  },
  identityName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  identityEmail: {
    fontSize: 13,
    color: colors.textMuted,
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
    flexShrink: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuItemTextDestructive: {
    flexShrink: 1,
    fontSize: 16,
    color: colors.dislike,
    fontWeight: '500',
  },
});
