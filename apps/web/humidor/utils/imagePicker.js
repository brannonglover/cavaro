import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const IMAGE_DIR = `${FileSystem.documentDirectory}cigar_images/`;

async function ensureImageDir() {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
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
