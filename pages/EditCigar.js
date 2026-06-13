import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { uploadCigarImage } from '../api/upload';
import colors from '../theme/colors';
import { pickCigarImage, takeCigarPhoto } from '../utils/imagePicker';
import DatePickerField from '../components/DatePickerField';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import { trackEvent } from '../lib/analytics';

// Size format: #x## or #.#x## (e.g. 6x52, 7.5x50) - no slashes
const SIZE_FORMAT = /^\d+(\.\d+)?x\d+(\.\d+)?$/;
function isValidSizeFormat(size) {
  return size?.trim() && SIZE_FORMAT.test(size.trim());
}

export default function EditCigar() {
  const navigation = useNavigation();
  const route = useRoute();
  const cigar = route.params?.cigar;
  const { tier, supabase, refreshTier } = useAuth();

  const [brand, setBrand] = useState(cigar?.brand ?? '');
  const [name, setName] = useState(cigar?.name ?? '');
  const [line, setLine] = useState(cigar?.line ?? '');
  const [size, setSize] = useState(cigar?.length ?? '');
  const [description, setDescription] = useState(cigar?.description ?? '');
  const [wrapper, setWrapper] = useState(cigar?.wrapper ?? '');
  const [binder, setBinder] = useState(cigar?.binder ?? '');
  const [filler, setFiller] = useState(cigar?.filler ?? '');
  const [image, setImage] = useState(cigar?.image ?? '');
  const [quantity, setQuantity] = useState(String(cigar?.quantity ?? 1));
  const [dateAdded, setDateAdded] = useState(cigar?.date_added ?? '');
  const [upgradeModal, setUpgradeModal] = useState({ visible: false, message: '', accessToken: null, userId: null });

  const scrollViewRef = useRef(null);

  const isValid = !!(brand?.trim() && name?.trim() && size?.trim() && isValidSizeFormat(size));

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  async function handleAddImage() {
    if (tier === 'free' && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) {
          Alert.alert('Sign in required', 'Please sign in to subscribe to Premium.');
          return;
        }
        setUpgradeModal({
          visible: true,
          message: 'Photos are a Premium feature. Subscribe for $2.99/mo to add photos to your cigars.',
          accessToken: session.access_token,
          userId: session.user?.id,
        });
      });
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const { uri, error } = await takeCigarPhoto();
            if (error) Alert.alert('Error', error);
            else if (uri) setImage(uri);
          } else if (buttonIndex === 2) {
            const { uri, error } = await pickCigarImage();
            if (error) Alert.alert('Error', error);
            else if (uri) setImage(uri);
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              const { uri, error } = await takeCigarPhoto();
              if (error) Alert.alert('Error', error);
              else if (uri) setImage(uri);
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const { uri, error } = await pickCigarImage();
              if (error) Alert.alert('Error', error);
              else if (uri) setImage(uri);
            },
          },
        ]
      );
    }
  }

  async function handleSave() {
    if (!cigar?.id || !isValid) return;
    if (!isValidSizeFormat(size)) {
      Alert.alert(
        'Invalid size format',
        'Size must be in the format #x## or #.#x## (e.g., 6x52, 7.5x50).',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      let imageUrl = image;
      if (image && image.startsWith('file://')) {
        try {
          imageUrl = await uploadCigarImage(image) || image;
        } catch (e) {
          console.warn('Image upload failed, keeping existing:', e.message);
        }
      }
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      const dateAddedVal = dateAdded.trim() ? dateAdded.trim() : null;
      await db.runAsync(
        `UPDATE cigars SET brand = ?, name = ?, line = ?, description = ?, wrapper = ?, binder = ?, filler = ?, length = ?, image = ?, quantity = ?, date_added = ? WHERE id = ?`,
        brand.trim(),
        name.trim(),
        line.trim() || null,
        description || '',
        wrapper || '',
        binder || '',
        filler || '',
        size.trim(),
        imageUrl || '',
        qty,
        dateAddedVal,
        cigar.id
      );
      trackEvent('cigar_edited');
      navigation.goBack();
    } catch (error) {
      console.log('Edit failed:', error);
      Alert.alert('Failed to save changes', error.message || 'Please try again.');
    }
  }

  if (!cigar) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Edit Cigar</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Cigar not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        collapsable={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Edit Cigar</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          collapsable={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit cigar details</Text>
            <Text style={styles.sectionSubtitle}>Correct any mistakes below</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Brand *</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Alec Bradley"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Prensado"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Line / Series (optional)</Text>
            <TextInput
              style={styles.input}
              value={line}
              onChangeText={setLine}
              placeholder="e.g. Blue Label, Series JJ"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Size *</Text>
            <TextInput
              style={[styles.input, size && !isValidSizeFormat(size) && styles.inputError]}
              value={size}
              onChangeText={setSize}
              placeholder="e.g. 6x52 or 7.5x50"
              placeholderTextColor={colors.placeholderText}
              returnKeyType="done"
            />
            {size && !isValidSizeFormat(size) && (
              <Text style={styles.errorText}>Size must be #x## or #.#x## (e.g. 6x52, 7.5x50)</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="1"
              placeholderTextColor={colors.placeholderText}
              keyboardType="number-pad"
            />
          </View>

          <DatePickerField
            label="Date added to Cavaro (optional)"
            value={dateAdded}
            onChange={setDateAdded}
            placeholder="Tap to pick date"
            optional
          />

          <View style={styles.field}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Cigar description"
              placeholderTextColor={colors.placeholderText}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Wrapper (optional)</Text>
            <TextInput
              style={styles.input}
              value={wrapper}
              onChangeText={setWrapper}
              placeholder="e.g. Honduras"
              placeholderTextColor={colors.placeholderText}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Binder (optional)</Text>
            <TextInput
              style={styles.input}
              value={binder}
              onChangeText={setBinder}
              placeholder="e.g. Nicaragua"
              placeholderTextColor={colors.placeholderText}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Filler (optional)</Text>
            <TextInput
              style={styles.input}
              value={filler}
              onChangeText={setFiller}
              placeholder="e.g. Honduras, Nicaragua"
              placeholderTextColor={colors.placeholderText}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Photo (optional)</Text>
            <Pressable style={styles.imagePickerBtn} onPress={handleAddImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <Text style={styles.imagePickerText}>📷 Take photo or choose from library</Text>
              )}
            </Pressable>
            {image ? (
              <Pressable onPress={() => setImage('')} style={styles.removeImageBtn}>
                <Text style={styles.removeImageText}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid}
          >
            <Text style={[styles.primaryBtnText, !isValid && styles.primaryBtnTextDisabled]}>Save Changes</Text>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
      <UpgradeToPremiumModal
        visible={upgradeModal.visible}
        message={upgradeModal.message}
        onClose={() => setUpgradeModal((p) => ({ ...p, visible: false }))}
        accessToken={upgradeModal.accessToken}
        userId={upgradeModal.userId}
        tier={tier}
        refreshTier={refreshTier}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    minWidth: 70,
  },
  backText: {
    fontSize: 17,
    color: colors.accent,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingVertical: 16,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  primaryBtnTextDisabled: {
    color: colors.textMuted,
  },
  bottomSpacer: {
    height: 40,
  },
  imagePickerBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    borderStyle: 'dashed',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  imagePickerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  removeImageBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removeImageText: {
    fontSize: 14,
    color: colors.dislike,
    fontWeight: '500',
  },
  inputError: {
    borderColor: colors.dislike,
  },
  errorText: {
    fontSize: 13,
    color: colors.dislike,
    marginTop: 6,
  },
  hintText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
