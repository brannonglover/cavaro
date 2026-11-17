import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const IMAGE_DIR = `${FileSystem.documentDirectory}cigar_images/`;
const AVATAR_DIR = `${FileSystem.documentDirectory}avatar_images/`;

async function ensureDir(dir) {
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function ensureImageDir() {
  return ensureDir(IMAGE_DIR);
}

/**
 * Copies a picked asset somewhere durable. The picker hands back a cache URI
 * that iOS is free to purge, so anything we intend to keep or upload later has
 * to be copied into the document directory first.
 */
async function persist(sourceUri, { dir, prefix }) {
  await ensureDir(dir);
  const destUri = `${dir}${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

/**
 * Pick image from camera or library. Returns a persistent URI in app's document directory.
 */
export async function pickCigarImage() {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (cameraStatus !== 'granted' && libraryStatus !== 'granted') {
    return { error: 'Camera and photo library permissions are required' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled) {
    return { uri: null };
  }

  const sourceUri = result.assets[0].uri;
  const filename = `cigar_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const destUri = `${IMAGE_DIR}${filename}`;

  await ensureImageDir();
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  return { uri: destUri };
}

/**
 * Take a photo with the camera. Returns a persistent URI.
 */
export async function takeCigarPhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return { error: 'Camera permission is required' };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled) {
    return { uri: null };
  }

  const sourceUri = result.assets[0].uri;
  const filename = `cigar_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const destUri = `${IMAGE_DIR}${filename}`;

  await ensureImageDir();
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  return { uri: destUri };
}

/**
 * Profile photo from the library. Square crop, since it renders in a circle.
 */
export async function pickAvatarImage() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return { error: 'Photo library permission is required' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return { uri: null };

  return { uri: await persist(result.assets[0].uri, { dir: AVATAR_DIR, prefix: 'avatar' }) };
}

/** Profile photo from the camera. Square crop, as above. */
export async function takeAvatarPhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return { error: 'Camera permission is required' };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return { uri: null };

  return { uri: await persist(result.assets[0].uri, { dir: AVATAR_DIR, prefix: 'avatar' }) };
}
