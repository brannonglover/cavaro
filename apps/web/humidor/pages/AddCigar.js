import { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import DropDownPicker from 'react-native-dropdown-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db, COLLECTIONS } from '../db';
import colors from '../theme/colors';
import { pickCigarImage, takeCigarPhoto } from '../utils/imagePicker';

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

export default function AddCigar() {
  const navigation = useNavigation();
  const [showCustom, setShowCustom] = useState(false);

  // Catalog selection state
  const [cigarBrand, setCigarBrand] = useState('');
  const [cigarName, setCigarName] = useState('');
  const [cigarSize, setCigarSize] = useState('');
  const [cigarDescription, setCigarDescription] = useState('');
  const [cigarWrapper, setCigarWrapper] = useState('');
  const [cigarBinder, setCigarBinder] = useState('');
  const [cigarFiller, setCigarFiller] = useState('');
  const [cigarImage, setCigarImage] = useState('');

  // Custom form state
  const [customBrand, setCustomBrand] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customWrapper, setCustomWrapper] = useState('');
  const [customBinder, setCustomBinder] = useState('');
  const [customFiller, setCustomFiller] = useState('');
  const [customImage, setCustomImage] = useState('');

  // Catalog data
  const [data, setData] = useState([]);
  const [brandArr, setBrandArr] = useState([]);
  const [cigarNameArr, setCigarNameArr] = useState([]);
  const [cigarSizeArr, setCigarSizeArr] = useState([]);

  // Dropdown open state
  const [brandOpen, setBrandOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    try {
      const rows = await db.getAllAsync('SELECT * FROM cigar_catalog ORDER BY brand, name, length');
      setData(rows);
      const brands = [...new Set(rows.map((r) => r.brand))].filter(Boolean).sort();
      setBrandArr(brands.map((b) => ({ label: b, value: b })));
    } catch (err) {
      console.error('Failed to load cigar catalog:', err);
    }
  }

  function fillCigarName(brand) {
    const byBrand = data.filter((c) => c.brand === brand);
    const uniqueNames = [...new Set(byBrand.map((c) => c.name))];
    setCigarNameArr(uniqueNames.map((n) => ({ label: n, value: n })));
    setCigarName('');
    setCigarSize('');
    setCigarSizeArr([]);
  }

  async function handleAddImage(setImage) {
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
      setCigarDescription(first.description || '');
      setCigarWrapper(first.wrapper || '');
      setCigarBinder(first.binder || '');
      setCigarFiller(first.filler || '');
    }
  }

  async function addFromCatalog() {
    if (!cigarBrand?.trim() || !cigarName?.trim() || !cigarSize?.trim()) return;
    try {
      await db.runAsync(
        'INSERT INTO cigars (brand, name, description, wrapper, binder, filler, length, image, collection) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        cigarBrand.trim(),
        cigarName.trim(),
        cigarDescription,
        cigarWrapper,
        cigarBinder,
        cigarFiller,
        cigarSize.trim(),
        cigarImage || '',
        COLLECTIONS.HUMIDOR
      );
      navigation.goBack();
    } catch (error) {
      console.log('Add failed:', error);
    }
  }

  async function addCustom() {
    if (!customBrand?.trim() || !customName?.trim() || !customSize?.trim()) return;
    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO cigar_catalog (brand, name, description, wrapper, binder, filler, length, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, '')`,
        customBrand.trim(),
        customName.trim(),
        customDesc || '',
        customWrapper || '',
        customBinder || '',
        customFiller || '',
        customSize.trim()
      );
      await db.runAsync(
        'INSERT INTO cigars (brand, name, description, wrapper, binder, filler, length, image, collection) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        customBrand.trim(),
        customName.trim(),
        customDesc || '',
        customWrapper || '',
        customBinder || '',
        customFiller || '',
        customSize.trim(),
        customImage || '',
        COLLECTIONS.HUMIDOR
      );
      navigation.goBack();
    } catch (error) {
      console.log('Add custom failed:', error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Add Cigar</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!showCustom ? (
            <>
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

              <Pressable style={styles.primaryBtn} onPress={addFromCatalog}>
                <Text style={styles.primaryBtnText}>Add to Humidor</Text>
              </Pressable>

              <Pressable style={styles.switchLink} onPress={() => setShowCustom(true)}>
                <Text style={styles.switchLinkText}>Can't find your cigar? Add custom</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add custom cigar</Text>
                <Text style={styles.sectionSubtitle}>Add a new cigar to the catalog and your humidor</Text>
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
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Size *</Text>
                <TextInput
                  style={styles.input}
                  value={customSize}
                  onChangeText={setCustomSize}
                  placeholder="e.g. 6x52"
                  placeholderTextColor={colors.placeholderText}
                />
              </View>

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

              <Pressable style={styles.primaryBtn} onPress={addCustom}>
                <Text style={styles.primaryBtnText}>Add to Catalog & Humidor</Text>
              </Pressable>

              <Pressable style={styles.switchLink} onPress={() => setShowCustom(false)}>
                <Text style={styles.switchLinkText}>← Back to catalog</Text>
              </Pressable>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 14,
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
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  switchLink: {
    marginTop: 20,
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
});
