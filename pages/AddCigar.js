import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { db, COLLECTIONS, withSerializedTransaction } from '../db';
import { fetchCatalog, addCigarToCatalog } from '../api/catalog';
import { serializeFlavors } from '../lib/tasteVocabulary';
import { uploadCigarImage } from '../api/upload';
import { productImageUrl } from '../lib/cigarImage';
import { useAuth } from '../context/AuthContext';
import { scheduleFullPush } from '../lib/userCigarsSync';
import colors from '../theme/colors';
import { pickCigarImage, takeCigarPhoto } from '../utils/imagePicker';
import DatePickerField, { getTodayDateString } from '../components/DatePickerField';
import CreatableSelectField from '../components/CreatableSelectField';
import SelectSheetField from '../components/SelectSheetField';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import { trackCigarAdded } from '../lib/analytics';
import { FREE_CIGAR_LIMIT } from '../constants/limits';
import { collectBlendValues, loadKnownBlendOptions } from '../utils/blendOptions';
import { useTabBarHeight } from '../navigation/useTabBarHeight';

// Size format: #x## or #.#x## (e.g. 6x52, 7.5x50) - no slashes
const SIZE_FORMAT = /^\d+(\.\d+)?x\d+(\.\d+)?$/;
function isValidSizeFormat(size) {
  return size?.trim() && SIZE_FORMAT.test(size.trim());
}

const SUGGESTION_SCROLL_PADDING = 220;

export default function AddCigar() {
  const navigation = useNavigation();
  const route = useRoute();
  const targetHumidorId = route.params?.humidorId ?? 1;
  const { tier, supabase, refreshTier } = useAuth();
  const tabBarHeight = useTabBarHeight();
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
  const [blendOptions, setBlendOptions] = useState({ wrapper: [], binder: [], filler: [] });

  const isCatalogValid = !!(cigarBrand?.trim() && cigarName?.trim() && cigarSize?.trim());
  const isCustomValid = !!(customBrand?.trim() && customName?.trim() && customSize?.trim() && isValidSizeFormat(customSize));
  const scrollViewRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const wrapperFieldRef = useRef(null);
  const binderFieldRef = useRef(null);
  const fillerFieldRef = useRef(null);

  const scrollFieldIntoView = useCallback((fieldRef) => {
    const field = fieldRef.current;
    const scroll = scrollViewRef.current;
    if (!field || !scroll) return;
    field.measureInWindow((_x, y) => {
      const delta = y - 140;
      if (delta > 12) {
        scroll.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + delta),
          animated: true,
        });
      }
    });
  }, []);

  const handleBlendFieldOpen = useCallback((fieldRef) => {
    setTimeout(() => scrollFieldIntoView(fieldRef), 250);
  }, [scrollFieldIntoView]);

  const loadCatalog = useCallback(async () => {
    try {
      // Fetch shared catalog from API; fallback to local cache if offline
      let rows;
      try {
        rows = await fetchCatalog();
        // Cache in local SQLite for offline use (don't fail the screen if cache write fails)
        try {
          await withSerializedTransaction(async () => {
            await db.execAsync('DELETE FROM cigar_catalog');
            const seen = new Set();
            for (const c of rows) {
              const sizeName = c.size_name || '';
              const key = `${c.brand}::${c.name}::${c.length}::${sizeName}`;
              if (seen.has(key)) continue;
              seen.add(key);
              await db.runAsync(
                `INSERT INTO cigar_catalog (
                   brand, name, line, description, wrapper, binder, filler, length, image, size_name,
                   flavors, strength, taste_source
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                c.brand,
                c.name,
                c.line || '',
                c.description || '',
                c.wrapper || '',
                c.binder || '',
                c.filler || '',
                c.length,
                c.image || '',
                sizeName,
                serializeFlavors(c.flavors),
                c.strength || null,
                c.taste_source || null
              );
            }
          });
        } catch (cacheErr) {
          console.warn('Catalog cache write failed:', cacheErr.message);
        }
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
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      loadCatalog();
      if (enforceLimit) {
        db.getFirstAsync("SELECT COUNT(*) as n FROM cigars WHERE collection = 'cavaro'")
          .then((r) => setCigarCount(r?.n ?? 0));
      }
    }, [enforceLimit, loadCatalog])
  );

  useEffect(() => {
    async function refreshBlendOptions() {
      try {
        const cigarRows = await db.getAllAsync('SELECT wrapper, binder, filler FROM cigars');
        const rows = [...data, ...cigarRows];
        setBlendOptions({
          wrapper: collectBlendValues(rows, 'wrapper'),
          binder: collectBlendValues(rows, 'binder'),
          filler: collectBlendValues(rows, 'filler'),
        });
      } catch (err) {
        console.warn('Failed to load blend options:', err.message);
        try {
          setBlendOptions(await loadKnownBlendOptions(db));
        } catch (fallbackErr) {
          console.warn('Blend options fallback failed:', fallbackErr.message);
        }
      }
    }
    refreshBlendOptions();
  }, [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [showCustom]);

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
      setCigarImage(productImageUrl(match.image) || '');
    }
  }, [prefill, data, route.params]);

  // Keep name options in sync with the selected brand.
  useEffect(() => {
    if (!cigarBrand) {
      setCigarNameArr([]);
      return;
    }
    const byBrand = data.filter((c) => c.brand === cigarBrand);
    const uniqueNames = [...new Set(byBrand.map((c) => c.name).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    setCigarNameArr(uniqueNames.map((n) => ({ label: n, value: n })));
  }, [cigarBrand, data]);

  // Keep size options + blend details in sync with brand + name.
  useEffect(() => {
    if (!cigarBrand || !cigarName) {
      setCigarSizeArr([]);
      return;
    }
    const byBrandAndName = data.filter((c) => c.brand === cigarBrand && c.name === cigarName);
    const sizeOptions = byBrandAndName
      .map((c) => {
        const sizeName = (c.size_name || '').trim();
        const length = (c.length || '').trim();
        return {
          label: sizeName ? `${sizeName} - ${length}` : length,
          // Encode size_name so duplicate lengths (Toro vs Torpedo) stay selectable.
          value: sizeName ? `${sizeName}::${length}` : length,
          sortKey: sizeName || length,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    // Dedupe by value while preserving order
    const seen = new Set();
    setCigarSizeArr(
      sizeOptions
        .filter((opt) => {
          if (!opt.value || seen.has(opt.value)) return false;
          seen.add(opt.value);
          return true;
        })
        .map(({ label, value }) => ({ label, value }))
    );
    if (byBrandAndName.length > 0) {
      const first = byBrandAndName[0];
      setCigarLine(first.line || '');
      setCigarDescription(first.description || '');
      setCigarWrapper(first.wrapper || '');
      setCigarBinder(first.binder || '');
      setCigarFiller(first.filler || '');
    }
  }, [cigarBrand, cigarName, data]);

  function resolveCatalogSelection() {
    const sizeName = cigarSize.includes('::') ? cigarSize.split('::')[0] : '';
    const length = cigarSize.includes('::') ? cigarSize.split('::').slice(1).join('::') : cigarSize;
    const match = data.find(
      (c) =>
        c.brand === cigarBrand &&
        c.name === cigarName &&
        c.length === length &&
        (sizeName ? (c.size_name || '') === sizeName : true)
    );
    return {
      length,
      sizeName: sizeName || match?.size_name || '',
      match,
    };
  }

  function handleBrandChange(next) {
    const normalized = next ?? '';
    if (normalized !== cigarBrand) {
      setCigarName('');
      setCigarSize('');
      setCigarSizeArr([]);
      setCigarLine('');
      setCigarDescription('');
      setCigarWrapper('');
      setCigarBinder('');
      setCigarFiller('');
      setCigarImage('');
    }
    setCigarBrand(normalized);
  }

  function handleNameChange(next) {
    const normalized = next ?? '';
    if (normalized !== cigarName) {
      setCigarSize('');
    }
    setCigarName(normalized);
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
    const { length: resolvedLength, match } = resolveCatalogSelection();
    try {
      let imageUrl = '';
      if (cigarImage) {
        try {
          imageUrl = await uploadCigarImage(cigarImage) || '';
        } catch (e) {
          console.warn('Image upload failed, saving without image:', e.message);
        }
      }
      if (!imageUrl && match?.image) {
        imageUrl = productImageUrl(match.image) || '';
      }
      await db.runAsync(
        'INSERT INTO cigars (brand, name, line, description, wrapper, binder, filler, length, image, quantity, collection, date_added, humidor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        cigarBrand.trim(),
        cigarName.trim(),
        cigarLine.trim() || null,
        cigarDescription,
        cigarWrapper,
        cigarBinder,
        cigarFiller,
        resolvedLength.trim(),
        imageUrl,
        qty,
        COLLECTIONS.CAVARO,
        dateToUse,
        targetHumidorId
      );
      scheduleFullPush(supabase);
      trackCigarAdded({
        source: 'catalog',
        brand: cigarBrand,
        name: cigarName,
        line: cigarLine,
        length: resolvedLength,
        quantity: qty,
      });
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
        'INSERT INTO cigars (brand, name, line, description, wrapper, binder, filler, length, image, quantity, collection, date_added, humidor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        dateToUse,
        targetHumidorId
      );
      scheduleFullPush(supabase);
      trackCigarAdded({
        source: 'custom',
        brand: customBrand,
        name: customName,
        line: customLine,
        length: customSize,
        quantity: qty,
      });

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']} collapsable={false}>
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
          {!showCustom ? (
            <Pressable onPress={() => setShowCustom(true)} style={styles.headerActionBtn} hitSlop={12}>
              <Text style={styles.switchLinkText}>+ Add new</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setShowCustom(false)} style={styles.headerActionBtn} hitSlop={12}>
              <Text style={styles.switchLinkText}>Back to catalog</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 24 + (tabBarHeight || 0) + (showCustom ? SUGGESTION_SCROLL_PADDING : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          collapsable={false}
        >
          {!showCustom ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select from catalog</Text>
                <Text style={styles.sectionSubtitle}>Choose brand, name, and size from the database</Text>
              </View>

              <SelectSheetField
                label="Brand"
                value={cigarBrand || ''}
                items={brandArr}
                onChange={handleBrandChange}
                placeholder="Select brand"
                searchPlaceholder="Search brands"
              />

              <SelectSheetField
                label="Cigar name"
                value={cigarName || ''}
                items={cigarNameArr}
                onChange={handleNameChange}
                placeholder={
                  !cigarBrand
                    ? 'Select a brand first'
                    : cigarNameArr.length
                      ? 'Select cigar'
                      : 'No cigars for this brand'
                }
                searchPlaceholder="Search cigars"
                disabled={!cigarBrand || cigarNameArr.length === 0}
                emptyText="No cigars for this brand"
              />

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

              <SelectSheetField
                label="Size"
                value={cigarSize || ''}
                items={cigarSizeArr}
                onChange={setCigarSize}
                placeholder={cigarName ? 'Select size' : 'Select a cigar first'}
                searchPlaceholder="Search sizes"
                disabled={!cigarName || cigarSizeArr.length === 0}
                emptyText="No sizes for this cigar"
              />

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

              <View ref={wrapperFieldRef} collapsable={false}>
                <CreatableSelectField
                  label="Wrapper (optional)"
                  value={customWrapper}
                  onChangeText={setCustomWrapper}
                  options={blendOptions.wrapper}
                  placeholder="e.g. Honduras"
                  zIndex={3000}
                  onOpen={() => handleBlendFieldOpen(wrapperFieldRef)}
                />
              </View>

              <View ref={binderFieldRef} collapsable={false}>
                <CreatableSelectField
                  label="Binder (optional)"
                  value={customBinder}
                  onChangeText={setCustomBinder}
                  options={blendOptions.binder}
                  placeholder="e.g. Nicaragua"
                  zIndex={2000}
                  onOpen={() => handleBlendFieldOpen(binderFieldRef)}
                />
              </View>

              <View ref={fillerFieldRef} collapsable={false}>
                <CreatableSelectField
                  label="Filler (optional)"
                  value={customFiller}
                  onChangeText={setCustomFiller}
                  options={blendOptions.filler}
                  placeholder="e.g. Honduras, Nicaragua"
                  zIndex={1000}
                  onOpen={() => handleBlendFieldOpen(fillerFieldRef)}
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
  headerActionBtn: {
    minWidth: 110,
    alignItems: 'flex-end',
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
