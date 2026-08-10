/**
 * Android Free launch: react-native-iap@14 (Nitro / openiap-google) requires
 * Kotlin 2.2+, which conflicts with Expo SDK 52's Kotlin 1.9 toolchain.
 * Premium remains iOS-only for now; re-enable Android linking when upgrading
 * Expo / Kotlin or implementing Play Billing.
 */
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: null,
      },
    },
    'react-native-nitro-modules': {
      platforms: {
        android: null,
      },
    },
  },
};
