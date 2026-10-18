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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { db, COLLECTIONS } from '../db';
import { addCigarToCatalog } from '../api/catalog';
import { uploadCigarImage } from '../api/upload';
import { productImageUrl } from '../lib/cigarImage';
import { useAuth } from '../context/AuthContext';
import { scheduleFullPush } from '../lib/userCigarsSync';
import { getCachedCatalogRows, syncCatalogCache } from '../lib/catalogSync';
import { maybeFailSave } from '../lib/devFailpoints';
import colors from '../theme/colors';
import { pickCigarImage, takeCigarPhoto } from '../utils/imagePicker';
import DatePickerField, { getTodayDateString } from '../components/DatePickerField';
import CreatableSelectField from '../components/CreatableSelectField';
import SelectSheetField from '../components/SelectSheetField';
import UpgradeToPremiumModal from '../components/UpgradeToPremiumModal';
import SignupPromptModal from '../components/SignupPromptModal';
import { trackCigarAdded, trackEvent } from '../lib/analytics';
import { FREE_CIGAR_LIMIT } from '../constants/limits';
import { collectBlendValues, loadKnownBlendOptions } from '../utils/blendOptions';
import { useTabBarHeight } from '../navigation/useTabBarHeight';
import {
  isValidSizeFormat,
  missingCatalogFields,
  missingCustomFields,
  missingFieldsMessage,
  validationReason,
  categorizeError,
  catalogState,
  progressStage,
} from '../lib/addCigarValidation';

const SUGGESTION_SCROLL_PADDING = 220;

export default function AddCigar() {
  const navigation = useNavigation();
  const route = useRoute();
  const targetHumidorId = route.params?.humidorId ?? 1;
  // Low-cardinality label for where the user came from.
  const entryPoint = route.params?.prefillBrand
    ? 'search_prefill'
    : route.params?.entryPoint || 'direct';
  const { tier, user, supabase, refreshTier, isGuest, requestSignup } = useAuth();
  const tabBarHeight = useTabBarHeight();
  const [showCustom, setShowCustom] = useState(false);
  const [cigarCount, setCigarCount] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState({ visible: false, message: '', accessToken: null, userId: null });
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const enforceLimit = tier === 'free' && !!user;

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

  // Catalog load lifecycle + save guard. These exist so the screen can always
  // explain itself: loading, empty, failed, or "here is what is still missing".
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationHint, setValidationHint] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);

  const isCatalogValid = !!(cigarBrand?.trim() && cigarName?.trim() && cigarSize?.trim());
  const isCustomValid = !!(customBrand?.trim() && customName?.trim() && customSize?.trim() && isValidSizeFormat(customSize));
  const catalogStatus = catalogState({
    loading: catalogLoading,
    failed: catalogFailed,
    itemCount: brandArr.length,
  });

  // Analytics bookkeeping: keeps each funnel event to one emission per real
  // interaction instead of one per render.
  const completedAddRef = useRef(false);
  const attemptedAddRef = useRef(false);
  const trackedSelectionRef = useRef({ brand: '', name: '', size: '' });
  const trackedCatalogOutcomeRef = useRef(null);
  const savingRef = useRef(false);
  const scrollViewRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const wrapperFieldRef = useRef(null);
  const binderFieldRef = useRef(null);
  const fillerFieldRef = useRef(null);
  const brandFieldRef = useRef(null);
  const nameFieldRef = useRef(null);
  const sizeFieldRef = useRef(null);

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

  /**
   * Scrolls the first unfilled required field into view after a failed attempt.
   *
   * Deliberately not scrollFieldIntoView: that one only scrolls downward (it
   * exists to lift a field above an opening sheet), so it cannot reveal a
   * required field that is above the fold — which is the common case, since the
   * Add button sits below every field it validates.
   */
  const focusFirstMissingField = useCallback((missing = []) => {
    const refs = { brand: brandFieldRef, name: nameFieldRef, size: sizeFieldRef };
    const field = refs[missing[0]]?.current;
    const scroll = scrollViewRef.current;
    if (!field || !scroll) return;
    field.measureInWindow((_x, y) => {
      const delta = y - 180;
      if (Math.abs(delta) > 12) {
        scroll.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true });
      }
    });
  }, []);

  // Set to false on unmount so an in-flight catalog load cannot update state or
  // report an outcome for a screen the user has already left.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyCatalogRows = useCallback((rows) => {
    if (!mountedRef.current) return;
    const safe = Array.isArray(rows) ? rows : [];
    setData(safe);
    const brands = [...new Set(safe.map((r) => r.brand))].filter(Boolean).sort();
    setBrandArr(brands.map((b) => ({ label: b, value: b })));
  }, []);

  const reportCatalogOutcome = useCallback(
    (outcome, { itemCount = 0, source = null, error = null } = {}) => {
      // One emission per distinct outcome per visit, not per render.
      if (!mountedRef.current) return;
      const key = `${outcome}:${source || ''}`;
      if (trackedCatalogOutcomeRef.current === key) return;
      trackedCatalogOutcomeRef.current = key;
      if (outcome === 'loaded') {
        trackEvent('add_cigar_catalog_loaded', {
          is_guest: !!isGuest,
          entry_point: entryPoint,
          catalog_item_count: itemCount,
          source,
        });
      } else {
        trackEvent('add_cigar_catalog_failed', {
          is_guest: !!isGuest,
          entry_point: entryPoint,
          error_category: categorizeError(error),
        });
      }
    },
    [isGuest, entryPoint]
  );

  /**
   * Cache-first load.
   *
   * Renders whatever is cached immediately, then asks the shared
   * `syncCatalogCache()` for a refresh. That call is deduplicated app-wide, so
   * arriving here while Home's background refresh is still running joins it
   * instead of starting a second ~1MB download, and the two can no longer race
   * each other's writes.
   */
  const loadCatalog = useCallback(
    async ({ force = false } = {}) => {
      if (!mountedRef.current) return;
      setCatalogFailed(false);

      const cached = await getCachedCatalogRows();
      if (!mountedRef.current) return;
      if (cached.length) {
        applyCatalogRows(cached);
        setCatalogLoading(false);
      } else {
        setCatalogLoading(true);
      }

      const result = await syncCatalogCache({ force });
      if (!mountedRef.current) return;
      setCatalogLoading(false);

      if (result.status === 'synced') {
        const fresh = await getCachedCatalogRows();
        if (!mountedRef.current) return;
        applyCatalogRows(fresh);
        reportCatalogOutcome('loaded', {
          itemCount: fresh.length,
          source: cached.length ? 'api_refresh' : 'api',
        });
        return;
      }

      if (cached.length) {
        // Stale or unrefreshed data still beats a dead form.
        reportCatalogOutcome('loaded', {
          itemCount: cached.length,
          source: result.status === 'failed' ? 'cache_after_error' : 'cache',
        });
        return;
      }

      setCatalogFailed(true);
      reportCatalogOutcome('failed', { error: result.error });
    },
    [applyCatalogRows, reportCatalogOutcome]
  );

  // Any edit to a required field retires the "what's missing" hint, so the
  // message never outlives the problem it describes.
  useEffect(() => {
    setValidationHint('');
    setInvalidFields([]);
  }, [cigarBrand, cigarName, cigarSize, customBrand, customName, customSize]);

  // Mirror the live selection into a ref so the blur handler can read it without
  // putting form state in the focus effect's dependency list.
  const selectionRef = useRef({ brand: '', name: '', size: '', custom: false });
  // Catalog-only mirror, used to seed the selection tracker on focus.
  const catalogSelectionRef = useRef({ brand: '', name: '', size: '' });
  useEffect(() => {
    catalogSelectionRef.current = { brand: cigarBrand, name: cigarName, size: cigarSize };
  }, [cigarBrand, cigarName, cigarSize]);
  useEffect(() => {
    selectionRef.current = {
      brand: showCustom ? customBrand : cigarBrand,
      name: showCustom ? customName : cigarName,
      size: showCustom ? customSize : cigarSize,
      custom: showCustom,
    };
  }, [showCustom, cigarBrand, cigarName, cigarSize, customBrand, customName, customSize]);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      completedAddRef.current = false;
      attemptedAddRef.current = false;
      trackedCatalogOutcomeRef.current = null;
      // Seed from whatever is already selected rather than clearing. Navigating
      // back to this screen does not unmount it, so the previous brand/name/size
      // are still in state; clearing here meant re-picking the same value fired
      // a second add_cigar_*_selected and inflated that funnel step.
      trackedSelectionRef.current = {
        brand: (catalogSelectionRef.current.brand || '').trim(),
        name: (catalogSelectionRef.current.name || '').trim(),
        size: (catalogSelectionRef.current.size || '').trim(),
      };
      loadCatalog();
      if (enforceLimit) {
        db.getFirstAsync("SELECT COUNT(*) as n FROM cigars WHERE collection = 'cavaro'")
          .then((r) => setCigarCount(r?.n ?? 0));
      }
      return () => {
        // A successful save navigates away too — that is not abandonment.
        if (completedAddRef.current) return;
        const { brand, name, size, custom } = selectionRef.current;
        trackEvent('add_cigar_abandoned', {
          is_guest: !!isGuest,
          entry_point: entryPoint,
          add_method: custom ? 'custom' : 'catalog',
          progress_stage: progressStage({ brand, name, size, attempted: attemptedAddRef.current }),
        });
      };
    }, [enforceLimit, loadCatalog, isGuest, entryPoint])
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

  /**
   * Fires a selection event at most once per distinct value, so re-picking the
   * same brand or a re-render never double-counts a funnel step.
   */
  function trackSelection(field, value) {
    const normalized = (value ?? '').trim();
    if (!normalized || trackedSelectionRef.current[field] === normalized) return;
    trackedSelectionRef.current[field] = normalized;
    trackEvent(`add_cigar_${field}_selected`, {
      is_guest: !!isGuest,
      entry_point: entryPoint,
      add_method: 'catalog',
    });
  }

  /** Drop the "what's missing" hint as soon as the user supplies something. */
  function clearValidationHint() {
    setValidationHint('');
    setInvalidFields([]);
  }

  /** Switches to the manual form and records where the user came from. */
  function openCustom(source) {
    setShowCustom(true);
    clearValidationHint();
    trackEvent('custom_cigar_opened', {
      is_guest: !!isGuest,
      entry_point: entryPoint,
      source,
    });
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
      // Brand changed, so the old name/size selections no longer count as done.
      trackedSelectionRef.current.name = '';
      trackedSelectionRef.current.size = '';
    }
    setCigarBrand(normalized);
    trackSelection('brand', normalized);
  }

  function handleNameChange(next) {
    const normalized = next ?? '';
    if (normalized !== cigarName) {
      setCigarSize('');
      trackedSelectionRef.current.size = '';
    }
    setCigarName(normalized);
    trackSelection('name', normalized);
  }

  function handleSizeChange(next) {
    const normalized = next ?? '';
    setCigarSize(normalized);
    trackSelection('size', normalized);
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
    // Guard against double taps landing two inserts while the first is in flight.
    if (savingRef.current) return;

    attemptedAddRef.current = true;
    trackEvent('add_cigar_attempted', {
      is_guest: !!isGuest,
      entry_point: entryPoint,
      add_method: 'catalog',
      catalog_item_count: data.length,
    });

    // Never return silently: name what is missing, point at it, and record why.
    const missing = missingCatalogFields({ brand: cigarBrand, name: cigarName, size: cigarSize });
    const reason = validationReason({ missing });
    if (reason) {
      setInvalidFields(missing);
      setValidationHint(missingFieldsMessage(missing));
      focusFirstMissingField(missing);
      trackEvent('add_cigar_validation_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'catalog',
        validation_reason: reason,
        missing_fields: missing.join(','),
      });
      return;
    }
    clearValidationHint();

    if (enforceLimit && cigarCount >= FREE_CIGAR_LIMIT) {
      Alert.alert(
        'Limit reached',
        `Free tier allows up to ${FREE_CIGAR_LIMIT} cigars. Subscribe to Premium for unlimited.`,
        [{ text: 'OK' }]
      );
      trackEvent('add_cigar_validation_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'catalog',
        validation_reason: 'free_tier_limit',
        missing_fields: '',
      });
      return;
    }
    savingRef.current = true;
    setSaving(true);
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
      maybeFailSave('catalog');
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
      completedAddRef.current = true;
      if (isGuest) {
        trackEvent('guest_first_cigar_added', { cigar_count: cigarCount + 1 });
        setShowSignupPrompt(true);
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.log('Add failed:', error);
      trackEvent('add_cigar_save_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'catalog',
        error_category: categorizeError(error),
      });
      // The raw message here is a local database error (SQLITE_FULL, constraint
      // violations); it means nothing to a reader and leaks internals, so keep
      // it in the log and tell the user what they can actually do.
      Alert.alert(
        "Couldn't save that cigar",
        'Your selection is still here — tap Add to Cavaro to try again. If it keeps failing, restarting the app usually clears it.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function addCustom() {
    if (savingRef.current) return;

    attemptedAddRef.current = true;
    trackEvent('add_cigar_attempted', {
      is_guest: !!isGuest,
      entry_point: entryPoint,
      add_method: 'custom',
      catalog_item_count: data.length,
    });

    const missing = missingCustomFields({ brand: customBrand, name: customName, size: customSize });
    const reason = validationReason({ missing, size: customSize, requireSizeFormat: true });
    if (reason) {
      setInvalidFields(reason === 'invalid_size_format' ? ['size'] : missing);
      setValidationHint(
        reason === 'invalid_size_format'
          ? 'Size must look like 6x52 or 7.5x50.'
          : missingFieldsMessage(missing)
      );
      trackEvent('add_cigar_validation_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'custom',
        validation_reason: reason,
        missing_fields: missing.join(','),
      });
      return;
    }
    clearValidationHint();

    if (enforceLimit && cigarCount >= FREE_CIGAR_LIMIT) {
      Alert.alert(
        'Limit reached',
        `Free tier allows up to ${FREE_CIGAR_LIMIT} cigars. Subscribe to Premium for unlimited.`,
        [{ text: 'OK' }]
      );
      trackEvent('add_cigar_validation_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'custom',
        validation_reason: 'free_tier_limit',
        missing_fields: '',
      });
      return;
    }
    savingRef.current = true;
    setSaving(true);
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

      maybeFailSave('custom');
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
      // The local save is what the user cares about; the shared-catalog push
      // below is best-effort, so the add already counts as completed here.
      completedAddRef.current = true;

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
        if (isGuest) {
          trackEvent('guest_first_cigar_added', { cigar_count: cigarCount + 1 });
          setShowSignupPrompt(true);
        } else {
          navigation.goBack();
        }
      } catch (catalogErr) {
        console.warn('Catalog sync failed:', catalogErr.message);
        if (isGuest) {
          trackEvent('guest_first_cigar_added', { cigar_count: cigarCount + 1 });
          setShowSignupPrompt(true);
        } else {
          Alert.alert(
            'Added to Cavaro',
            'Your cigar was saved to your collection, but it could not be added to the shared catalog right now. You can still use it in Cavaro.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (error) {
      console.log('Add custom failed:', error);
      trackEvent('add_cigar_save_failed', {
        is_guest: !!isGuest,
        entry_point: entryPoint,
        add_method: 'custom',
        error_category: categorizeError(error),
      });
      // The raw message here is a local database error (SQLITE_FULL, constraint
      // violations); it means nothing to a reader and leaks internals, so keep
      // it in the log and tell the user what they can actually do.
      Alert.alert(
        "Couldn't save that cigar",
        'Your selection is still here — tap Add to Cavaro to try again. If it keeps failing, restarting the app usually clears it.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
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
            <Pressable onPress={() => openCustom('header')} style={styles.headerActionBtn} hitSlop={12}>
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

              {catalogStatus === 'loading' ? (
                <View style={styles.notice}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.noticeText}>Loading the cigar catalog…</Text>
                </View>
              ) : null}

              {catalogStatus === 'error' || catalogStatus === 'empty' ? (
                <View style={[styles.notice, styles.noticeError]}>
                  <Text style={styles.noticeText}>
                    {catalogStatus === 'error'
                      ? "Couldn't load the cigar catalog. Check your connection and try again, or enter your cigar by hand."
                      : 'The cigar catalog is empty right now. You can still enter your cigar by hand.'}
                  </Text>
                  <View style={styles.noticeActions}>
                    <Pressable
                      onPress={() => loadCatalog({ force: true })}
                      style={styles.noticeBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.noticeBtnText}>Retry</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openCustom('catalog_unavailable')}
                      style={styles.noticeBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.noticeBtnText}>Enter it by hand</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View ref={brandFieldRef} collapsable={false}>
                <SelectSheetField
                  label="Brand"
                  value={cigarBrand || ''}
                  items={brandArr}
                  onChange={handleBrandChange}
                  placeholder={
                    catalogStatus === 'loading'
                      ? 'Loading brands…'
                      : catalogStatus === 'ready'
                        ? 'Select brand'
                        : 'Catalog unavailable'
                  }
                  searchPlaceholder="Search brands"
                  disabled={catalogStatus !== 'ready'}
                  emptyText="No brands available"
                />
                {invalidFields.includes('brand') ? (
                  <Text style={styles.fieldError}>Brand is required</Text>
                ) : null}
              </View>

              <View ref={nameFieldRef} collapsable={false}>
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
                {invalidFields.includes('name') ? (
                  <Text style={styles.fieldError}>Cigar name is required</Text>
                ) : null}
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

              <View ref={sizeFieldRef} collapsable={false}>
                <SelectSheetField
                  label="Size"
                  value={cigarSize || ''}
                  items={cigarSizeArr}
                  onChange={handleSizeChange}
                  placeholder={cigarName ? 'Select size' : 'Select a cigar first'}
                  searchPlaceholder="Search sizes"
                  disabled={!cigarName || cigarSizeArr.length === 0}
                  emptyText="No sizes for this cigar"
                />
                {invalidFields.includes('size') ? (
                  <Text style={styles.fieldError}>Size is required</Text>
                ) : null}
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

              {validationHint ? <Text style={styles.validationHint}>{validationHint}</Text> : null}

              <Pressable
                style={[styles.primaryBtn, (!isCatalogValid || saving) && styles.primaryBtnDisabled]}
                onPress={addFromCatalog}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, busy: saving }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnText, !isCatalogValid && styles.primaryBtnTextDisabled]}>Add to Cavaro</Text>
                )}
              </Pressable>

              <Pressable onPress={() => openCustom('catalog_footer')} style={styles.customHintBtn} hitSlop={8}>
                <Text style={styles.customHintText}>Can&apos;t find your cigar? Enter it by hand</Text>
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

              {validationHint ? <Text style={styles.validationHint}>{validationHint}</Text> : null}

              <Pressable
                style={[styles.primaryBtn, (!isCustomValid || saving) && styles.primaryBtnDisabled]}
                onPress={addCustom}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, busy: saving }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnText, !isCustomValid && styles.primaryBtnTextDisabled]}>Add to Catalog & Cavaro</Text>
                )}
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
      <SignupPromptModal
        visible={showSignupPrompt}
        cigarCount={cigarCount + 1}
        onSignUp={(method) => {
          setShowSignupPrompt(false);
          // Apple signs in inline — the auth state change swaps the navigator,
          // so there is nothing left to route. Email needs the signup screen.
          if (method !== 'apple') requestSignup();
          navigation.goBack();
        }}
        onDismiss={() => {
          setShowSignupPrompt(false);
          navigation.goBack();
        }}
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  noticeError: {
    borderColor: colors.dislike,
  },
  noticeText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  noticeActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 10,
    width: '100%',
  },
  noticeBtn: {
    paddingVertical: 4,
  },
  noticeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  fieldError: {
    fontSize: 13,
    color: colors.dislike,
    marginTop: -15,
    marginBottom: 15,
  },
  validationHint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    marginTop: 12,
    marginBottom: -2,
  },
  customHintBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  customHintText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.accent,
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
