/**
 * API base URL for the Humidor backend.
 * - iOS Simulator: localhost works (simulator shares host network)
 * - Android Emulator: use 10.0.2.2 for localhost
 * - Physical device: use your machine's LAN IP (e.g. 192.168.1.x)
 */
import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  // Override for physical device: set EXPO_PUBLIC_API_URL to your machine's IP, e.g. http://192.168.1.94:5001
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5001'; // Android emulator localhost
    }
    return 'http://localhost:5001'; // iOS Simulator (5001 avoids macOS AirPlay on 5000)
  }
  return 'https://your-api.example.com'; // Production: replace with deployed URL
};

export const API_BASE_URL = getApiBaseUrl();
