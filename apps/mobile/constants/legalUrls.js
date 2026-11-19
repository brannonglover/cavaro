import Constants from 'expo-constants';

const extraLegal = Constants.expoConfig?.extra?.legal ?? {};

/**
 * Terms of Use. Defaults to cavaroapp.com; override via app.json extra.legal.termsOfUseUrl
 * or EXPO_PUBLIC_TERMS_OF_USE_URL.
 */
export function getTermsOfUseUrl() {
  return (
    process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ||
    extraLegal.termsOfUseUrl ||
    'https://cavaroapp.com/terms'
  );
}

/**
 * Privacy policy. Defaults to cavaroapp.com; override via app.json extra.legal.privacyPolicyUrl
 * or EXPO_PUBLIC_PRIVACY_POLICY_URL.
 */
export function getPrivacyPolicyUrl() {
  return (
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
    extraLegal.privacyPolicyUrl ||
    'https://cavaroapp.com/privacy'
  );
}
