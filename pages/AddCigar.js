import React, { useState, useEffect, useRef } from 'react';
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
import DropDownPicker from 'react-native-dropdown-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, COLLECTIONS } from '../db';
import { fetchCatalog, addCigarToCatalog } from '../api/catalog';
import { uploadCigarImage } from '../api/upload';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { pickCigarImage, takeCigarPhoto } from '../utils/imagePicker';
import DatePickerField, { getTodayDateString } from '../components/DatePickerField';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import { trackEvent } from '../lib/analytics';

const DropdownArrowDown = ({ style }) => (
  <View style={style}>
    <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textPrimary} />
  </View>
);
const DropdownArrowUp = ({ style }) => (
  <View style={style}>
    <MaterialCommunityIcons name="chevron-up" size={24} color={colors.textPrimary} />
  </View>
);

// Size format: #x## or #.#x## (e.g. 6x52, 7.5x50) - no slashes
const SIZE_FORMAT = /^\d+(\.\d+)?x\d+(\.\d+)?$/;
function isValidSizeFormat(size) {
  return size?.trim() && SIZE_FORMAT.test(size.trim());
}

const FREE_CIGAR_LIMIT = 5;

export default function AddCigar() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tier, supabase, refreshTier } = useAuth();
  const [showCustom, setShowCustom] = useState(false);
  const [cigarCount, setCigarCount] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState({ visible: false, message: '', accessToken: null, userId: null });
  const enforceLimit = tier === 'free' && supabase;

  // Catalog selection state
  const [cigarBrand, setCigarBrand] = useState('');
  const [cigarName, setCigarName] = useState('');
  const [cigarLine, setCigarLine] = useState('');
  const [cigarSize, setCigarSize] = useState('');
  const [cigarDescription, setCigarDescription] = useState('');
  const [cigarWrapper, setCigarWrapper] = useState('');
  const [cigarBinder, setCigarBinder] = useState('');
  const [cigarFiller, setCigarFiller] = useState('');
  const [cigarImage, setCigarImage] = useState('');
  const [cigarQuantity, setCigarQuantity] = useState('1');
  const [dateAdded, setDateAdded] = useState(() => getTodayDateString());

  // Custom form state
  const [customBrand, setCustomBrand] = useState('');
  const [customName, setCustomName] = useState('');
  const [customLine, setCustomLine] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customWrapper, setCustomWrapper] = useState('');
  const [customBinder, setCustomBinder] = useState('');
  const [customFiller, setCustomFiller] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');

  // Catalog data
  const [data, setData] = useState([]);
  const [brandArr, setBrandArr] = useState([]);
  const [cigarNameArr, setCigarNameArr] = useState([]);
  const [cigarSizeArr, setCigarSizeArr] = useState([]);

  // Dropdown open state
  const [brandOpen, setBrandOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const isCatalogValid = !!(cigarBrand?.trim() && cigarName?.trim() && cigarSize?.trim());
  const isCustomValid = !!(customBrand?.trim() && customName?.trim() && customSize?.trim() && isValidSizeFormat(customSize));
  const scrollViewRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (enforceLimit) {
        db.getFirstAsync("SELECT COUNT(*) as n FROM cigars WHERE collection = 'cavaro'")
          .then((r) => setCigarCount(r?.n ?? 0));
      }
    }, [enforceLimit])
  );

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [showCustom]);

  async function loadCatalog() {
    try {
      // Fetch shared catalog from API; fallback to local cache if offline
      let rows;
      try {
        rows = await fetchCatalog();
        // Cache in local SQLite for offline use
        await db.withTransactionAsync(async () => {
          await db.execAsync('DELETE FROM cigar_catalog');
          for (const c of rows) {
            await db.runAsync(
              `INSERT OR IGNORE INTO cigar_catalog (brand, name, line, description, wrapper, binder, filler, length, image)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              c.brand, c.name, c.line || '', c.description || '', c.wrapper || '', c.binder || '', c.filler || '', c.length, c.image || ''
            );
          }
        });
      } catch (apiErr) {
        console.warn('API catalog unavailable, using local cache:', apiErr.message);
        rows = await db.getAllAsync('SELECT * FROM cigar_catalog ORDER BY brand, name, length');
      }
      setData(rows);
      const brands = [...new Set(rows.map((r) => r.brand))].filter(Boolean).sort();
      setBrandArr(brands.map((b) => ({ label: b, value: b })));
    } catch (err) {
      console.error('Failed to load cigar catalog:', err);
    }
  }

  // Prefill from Search (when navigating from catalog result)
  const prefill = route.params?.prefillBrand && route.params?.prefillName && route.params?.prefillLength;
  useEffect(() => {
    if (!prefill || data.length === 0) return;
    const { prefillBrand, prefillName, prefillLength } = route.params;
    const match = data.find(
      (c) =>
        (c.brand || '').trim() === (prefillBrand || '').trim() &&
        (c.name || '').trim() === (prefillName || '').trim() &&
        (c.length || '').trim() === (prefillLength || '').trim()
    );
    if (match) {
      setCigarBrand(match.brand || '');
      setCigarName(match.name || '');
      setCigarLine(match.line || '');
      setCigarSize(match.length || '');
      setCigarDescription(match.description || '');
      setCigarWrapper(match.wrapper || '');
      setCigarBinder(match.binder || '');
      setCigarFiller(match.filler || '');
      setCigarImage(match.image || '');
      const byBrand = data.filter((c) => c.brand === match.brand);
      setCigarNameArr([...new Set(byBrand.map((c) => c.name))].map((n) => ({ label: n, value: n })));
      const byBrandName = data.filter((c) => c.brand === match.brand && c.name === match.name);
      setCigarSizeArr(byBrandName.map((c) => ({ label: c.length, value: c.length })));
    }
  }, [prefill, data, route.params]);

  function fillCigarName(brand) {
    const byBrand = data.filter((c) => c.brand === brand);
    const uniqueNames = [...new Set(byBrand.map((c) => c.name))];
    setCigarNameArr(uniqueNames.map((n) => ({ label: n, value: n })));
    setCigarName('');
    setCigarSize('');
    setCigarSizeArr([]);
  }

  async function handleAddImage(setImage) {
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

  function fillCigarSize(name) {
    const byBrandAndName = data.filter((c) => c.brand === cigarBrand && c.name === name);
    const sizes = byBrandAndName.map((c) => ({ label: c.length, value: c.length }));
    setCigarSizeArr(sizes);
    setCigarSize('');
    if (byBrandAndName.length > 0) {
      const first = byBrandAndName[0];
      setCigarLine(first.line || '');
      setCigarDescription(first.description || '');
      setCigarWrapper(first.wrapper || '');
      setCigarBinder(first.binder || '');
      setCigarFiller(first.filler || '');
    }
  }

  async function addFromCatalog() {
    if (!cigarBrand?.trim() || !cigarName?.trim() || !cigarSize?.trim()) return;
    if (enforceLimit && cigarCount >= FREE_CIGAR_LIMIT) {
      Alert.alert(
        'Limit reached',
        `Free tier allows up to ${FREE_CIGAR_LIMIT} cigars. Subscribe to Premium for unlimited.`,
        [{ text: 'OK' }]
      );
      return;
    }
    const qty = Math.max(1, parseInt(cigarQuantity, 10) || 1);
    const dateToUse = dateAdded?.trim() || new Date().toISOString().slice(0, 10);
    try {
      let imageUrl = '';
      if (cigarImage) {
        try {
          imageUrl = await uploadCigarImage(cigarImage) || '';
        } catch (e) {
          console.warn('Image upload failed, saving without image:', e.message);
        }
      }
      await db.runAsync(
        'INSERT INTO cigars (brand, name, line, description, wrapper, binder, filler, length, image, quantity, collection, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        cigarBrand.trim(),
        cigarName.trim(),
        cigarLine.trim() || null,
        cigarDescription,
        cigarWrapper,
        cigarBinder,
        cigarFiller,
        cigarSize.trim(),
        imageUrl,
        qty,
        COLLECTIONS.CAVARO,
        dateToUse
      );
      trackEvent('cigar_added', { source: 'catalog', quantity: qty });
      navigation.goBack();
    } catch (error) {
      console.log('Add failed:', error);
      Alert.alert(
        'Failed to add cigar',
        error.message || 'Could not save cigar locally. Please try again.'
      );
    }
  }

  async function addCustom() {
    if (!customBrand?.trim() || !customName?.trim() || !customSize?.trim()) return;
    if (enforceLimit && cigarCount >= FREE_CIGAR_LIMIT) {
      Alert.alert(
        'Limit reached',
        `Free tier allows up to ${FREE_CIGAR_LIMIT} cigars. Subscribe to Premium for unlimited.`,
        [{ text: 'OK' }]
      );
      return;
    }
    if (!isValidSizeFormat(customSize)) {
      Alert.alert(
        'Invalid size format',
        'Size must be in the format #x## or #.#x## (e.g., 6x52, 7.5x50). Please correct the size field.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      let imageUrl = '';
      if (customImage) {
        try {
          imageUrl = await uploadCigarImage(customImage) || '';
        } catch (e) {
          console.warn('Image upload failed, saving without image:', e.message);
        }
      }
      const qty = Math.max(1, parseInt(customQuantity, 10) || 1);
      const dateToUse = dateAdded?.trim() || new Date().toISOString().slice(0, 10);

      await db.runAsync(
        'INSERT INTO cigars (brand, name, line, description, wrapper, binder, filler, length, image, quantity, collection, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        customBrand.trim(),
        customName.trim(),
        customLine.trim() || null,
        customDesc || '',
        customWrapper || '',
        customBinder || '',
        customFiller || '',
        customSize.trim(),
        imageUrl,
        qty,
        COLLECTIONS.CAVARO,
        dateToUse
      );
      trackEvent('cigar_added', { source: 'custom', quantity: qty });

      try {
        await addCigarToCatalog({
          brand: customBrand.trim(),
          name: customName.trim(),
          line: customLine.trim() || '',
          description: customDesc || '',
          wrapper: customWrapper || '',
          binder: customBinder || '',
          filler: customFiller || '',
          length: customSize.trim(),
          image: imageUrl,
        });
        navigation.goBack();
      } catch (catalogErr) {
        console.warn('Catalog sync failed:', catalogErr.message);
        Alert.alert(
          'Added to Cavaro',
          'Your cigar was saved to your collection, but it could not be added to the shared catalog right now. You can still use it in Cavaro.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.log('Add custom failed:', error);
      Alert.alert(
        'Failed to add cigar',
        error.message || 'Could not save cigar locally. Please try again.'
      );
    }
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
          <Text style={styles.title}>
            Add Cigar{enforceLimit ? ` (${cigarCount}/${FREE_CIGAR_LIMIT})` : ''}
          </Text>
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
          {!showCustom ? (
            <>
              <Pressable style={styles.switchLinkTop} onPress={() => setShowCustom(true)}>
                <Text style={styles.switchLinkText}>Add new</Text>
              </Pressable>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select from catalog</Text>
                <Text style={styles.sectionSubtitle}>Choose brand, name, and size from the database</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Brand</Text>
                <DropDownPicker
                  open={brandOpen}
                  value={cigarBrand}
                  items={brandArr}
                  setOpen={setBrandOpen}
                  setValue={setCigarBrand}
                  placeholder="Select brand"
                  placeholderStyle={{ color: colors.placeholderText }}
                  ArrowDownIconComponent={DropdownArrowDown}
                  ArrowUpIconComponent={DropdownArrowUp}
                  theme="DARK"
                  listMode="SCROLLVIEW"
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                  listItemContainerStyle={styles.dropdownListItem}
                  listItemLabelStyle={styles.dropdownListItemLabel}
                  zIndex={3000}
                  zIndexInverse={1000}
                  onChangeValue={(value) => {
                    fillCigarName(value);
                    setCigarBrand(value);
                  }}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Cigar name</Text>
                <DropDownPicker
                  open={nameOpen}
                  value={cigarName}
                  items={cigarNameArr}
                  setOpen={setNameOpen}
                  setValue={setCigarName}
                  placeholder="Select cigar"
                  placeholderStyle={{ color: colors.placeholderText }}
                  ArrowDownIconComponent={DropdownArrowDown}
                  ArrowUpIconComponent={DropdownArrowUp}
                  theme="DARK"
                  listMode="SCROLLVIEW"
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                  listItemContainerStyle={styles.dropdownListItem}
                  listItemLabelStyle={styles.dropdownListItemLabel}
                  zIndex={2000}
                  zIndexInverse={2000}
                  onChangeValue={(value) => fillCigarSize(value)}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Line / Series (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={cigarLine}
                  onChangeText={setCigarLine}
                  placeholder="e.g. Blue Label, Series JJ"
                  placeholderTextColor={colors.placeholderText}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Size</Text>
                <DropDownPicker
                  open={sizeOpen}
                  value={cigarSize}
                  items={cigarSizeArr}
                  setOpen={setSizeOpen}
                  setValue={setCigarSize}
                  placeholder="Select size"
                  placeholderStyle={{ color: colors.placeholderText }}
                  ArrowDownIconComponent={DropdownArrowDown}
                  ArrowUpIconComponent={DropdownArrowUp}
                  theme="DARK"
                  listMode="SCROLLVIEW"
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                  listItemContainerStyle={styles.dropdownListItem}
                  listItemLabelStyle={styles.dropdownListItemLabel}
                  zIndex={1000}
                  zIndexInverse={1000}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={cigarQuantity}
                  onChangeText={setCigarQuantity}
                  placeholder="1"
                  placeholderTextColor={colors.placeholderText}
                  keyboardType="number-pad"
                />
              </View>

              <DatePickerField
                label="Date added to Cavaro"
                value={dateAdded}
                onChange={setDateAdded}
                placeholder="Today"
                optional={false}
              />

              {(cigarDescription || cigarWrapper || cigarBinder || cigarFiller) && (
                <View style={styles.detailsCard}>
                  <Text style={styles.detailsTitle}>Blend details</Text>
                  {cigarDescription ? (
                    <Text style={styles.detailsText}>{cigarDescription}</Text>
                  ) : null}
                  <View style={styles.detailsRow}>
                    {cigarWrapper ? (
                      <Text style={styles.detailItem}><Text style={styles.detailLabel}>Wrapper:</Text> {cigarWrapper}</Text>
                    ) : null}
                    {cigarBinder ? (
                      <Text style={styles.detailItem}><Text style={styles.detailLabel}>Binder:</Text> {cigarBinder}</Text>
                    ) : null}
                    {cigarFiller ? (
                      <Text style={styles.detailItem}><Text style={styles.detailLabel}>Filler:</Text> {cigarFiller}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Photo (optional)</Text>
                <Pressable style={styles.imagePickerBtn} onPress={() => handleAddImage(setCigarImage)}>
                  {cigarImage ? (
                    <Image source={{ uri: cigarImage }} style={styles.previewImage} />
                  ) : (
                    <Text style={styles.imagePickerText}>📷 Take photo or choose from library</Text>
                  )}
                </Pressable>
                {cigarImage ? (
                  <Pressable onPress={() => setCigarImage('')} style={styles.removeImageBtn}>
                    <Text style={styles.removeImageText}>Remove photo</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={[styles.primaryBtn, !isCatalogValid && styles.primaryBtnDisabled]}
                onPress={addFromCatalog}
                disabled={!isCatalogValid}
              >
                <Text style={[styles.primaryBtnText, !isCatalogValid && styles.primaryBtnTextDisabled]}>Add to Cavaro</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add custom cigar</Text>
                <Text style={styles.sectionSubtitle}>Add a new cigar to the catalog and your Cavaro</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Brand *</Text>
                <TextInput
                  style={styles.input}
                  value={customBrand}
                  onChangeText={setCustomBrand}
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
                  value={customName}
                  onChangeText={setCustomName}
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
                  value={customLine}
                  onChangeText={setCustomLine}
                  placeholder="e.g. Blue Label, Series JJ"
                  placeholderTextColor={colors.placeholderText}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Size *</Text>
                <TextInput
                  style={[styles.input, customSize && !isValidSizeFormat(customSize) && styles.inputError]}
                  value={customSize}
                  onChangeText={setCustomSize}
                  placeholder="e.g. 6x52 or 7.5x50"
                  placeholderTextColor={colors.placeholderText}
                  returnKeyType="done"
                />
                {customSize && !isValidSizeFormat(customSize) && (
                  <Text style={styles.errorText}>Size must be #x## or #.#x## (e.g. 6x52, 7.5x50)</Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={customQuantity}
                  onChangeText={setCustomQuantity}
                  placeholder="1"
                  placeholderTextColor={colors.placeholderText}
                  keyboardType="number-pad"
                />
              </View>

              <DatePickerField
                label="Date added to Cavaro"
                value={dateAdded}
                onChange={setDateAdded}
                placeholder="Today"
                optional={false}
              />

              <View style={styles.field}>
                <Text style={styles.label}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={customDesc}
                  onChangeText={setCustomDesc}
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
                  value={customWrapper}
                  onChangeText={setCustomWrapper}
                  placeholder="e.g. Honduras"
                  placeholderTextColor={colors.placeholderText}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Binder (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={customBinder}
                  onChangeText={setCustomBinder}
                  placeholder="e.g. Nicaragua"
                  placeholderTextColor={colors.placeholderText}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Filler (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={customFiller}
                  onChangeText={setCustomFiller}
                  placeholder="e.g. Honduras, Nicaragua"
                  placeholderTextColor={colors.placeholderText}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Photo (optional)</Text>
                <Pressable style={styles.imagePickerBtn} onPress={() => handleAddImage(setCustomImage)}>
                  {customImage ? (
                    <Image source={{ uri: customImage }} style={styles.previewImage} />
                  ) : (
                    <Text style={styles.imagePickerText}>📷 Take photo or choose from library</Text>
                  )}
                </Pressable>
                {customImage ? (
                  <Pressable onPress={() => setCustomImage('')} style={styles.removeImageBtn}>
                    <Text style={styles.removeImageText}>Remove photo</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={[styles.primaryBtn, !isCustomValid && styles.primaryBtnDisabled]}
                onPress={addCustom}
                disabled={!isCustomValid}
              >
                <Text style={[styles.primaryBtnText, !isCustomValid && styles.primaryBtnTextDisabled]}>Add to Catalog & Cavaro</Text>
              </Pressable>

              <Pressable style={styles.switchLink} onPress={() => setShowCustom(false)}>
                <Text style={styles.switchLinkText}>← Back to catalog</Text>
              </Pressable>
            </>
          )}

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
    paddingBottom: 20,
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
  dropdown: {
    backgroundColor: colors.cardBg,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownContainer: {
    backgroundColor: colors.cardBg,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownListItem: {
    backgroundColor: colors.cardBg,
  },
  dropdownListItemLabel: {
    color: colors.textPrimary,
  },
  detailsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  detailsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  detailsText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  detailsRow: {
    marginTop: 4,
  },
  detailItem: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  detailLabel: {
    fontWeight: '600',
    color: colors.textPrimary,
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
  switchLink: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchLinkTop: {
    marginBottom: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchLinkText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
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
});
