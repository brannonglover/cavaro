import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra?.iap ?? {};

/**
 * Auto-renewable subscription product id (must match App Store Connect).
 * Override: app.json extra.iap.premiumProductId or EXPO_PUBLIC_IOS_PREMIUM_PRODUCT_ID.
 */
export const IOS_PREMIUM_PRODUCT_ID =
  process.env.EXPO_PUBLIC_IOS_PREMIUM_PRODUCT_ID ||
  extra.premiumProductId ||
  'com.gloverlabs.cavaro.monthly_premium';
