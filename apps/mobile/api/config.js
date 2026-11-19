/**
 * API base URL for the Cavaro backend.
 *
 * Local dev (npx expo start): .env.development sets EXPO_PUBLIC_API_URL= so we use:
 *   - iOS Simulator: localhost
 *   - Android Emulator: 10.0.2.2
 *   - Physical device: set EXPO_PUBLIC_API_URL in .env.development.local (e.g. http://192.168.1.x:5001)
 *
 * Production: .env or EAS build env sets EXPO_PUBLIC_API_URL to Railway URL.
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

/** Turn React Native fetch failures into actionable copy (physical device + local server). */
export function formatFetchReachabilityError(err, action = 'reach the server') {
  const msg = err?.message || String(err);
  if (msg.includes('Network request failed') || err?.name === 'TypeError') {
    if (__DEV__) {
      const localhostHint = /localhost|127\.0\.0\.1/.test(API_BASE_URL)
        ? " On a physical iPhone, localhost won't work—set EXPO_PUBLIC_API_URL in .env.development.local to your Mac's IP (e.g. http://192.168.1.x:5001), then rebuild."
        : '';
      return (
        `Cannot ${action}. The app is trying ${API_BASE_URL}. ` +
        'Make sure the server is running (npm start in server/) and your phone is on the same Wi‑Fi.' +
        localhostHint
      );
    }
    return `Cannot ${action}. Check your connection and try again.`;
  }
  return msg;
}
