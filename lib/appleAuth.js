/**
 * Sign in with Apple.
 *
 * Native flow via expo-apple-authentication, exchanged for a Supabase session
 * with signInWithIdToken. iOS only — callers should gate on isAppleAuthAvailable().
 *
 * Replay protection uses the standard two-value nonce dance:
 *   1. generate a random raw nonce
 *   2. hand Apple its SHA-256 hash, which Apple copies verbatim into the
 *      identity token's `nonce` claim
 *   3. hand Supabase the RAW nonce; Supabase hashes it and compares
 * A mismatch (or a token replayed without the matching raw nonce) is rejected.
 *
 * Token authenticity itself is Supabase's job, not ours: it fetches Apple's
 * JWKS and verifies the signature, issuer, audience (the bundle identifier
 * registered as a Client ID on the provider) and expiry before issuing a
 * session. The client never trusts the token on its own.
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

/** User tapped Cancel in the Apple sheet. Not an error — callers stay silent. */
export const APPLE_CANCELED = 'APPLE_CANCELED';

/** Apple rejected the request outright — almost always a missing entitlement. */
export const APPLE_NOT_CONFIGURED = 'APPLE_NOT_CONFIGURED';

/**
 * Whether Sign in with Apple can run on this device.
 *
 * IMPORTANT: this reports device/OS capability only (iOS 13+). It does NOT
 * verify that the Sign In with Apple entitlement is in the build, that the
 * capability is enabled on the App ID, or that Supabase's Apple provider is
 * configured. Any of those being wrong still yields `true` here and fails at
 * signInAsync — which is why signInWithApple maps that failure to a specific
 * APPLE_NOT_CONFIGURED message instead of a generic error.
 */
export async function isAppleAuthAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function fullNameToFirstName(fullName) {
  const given = fullName?.givenName?.trim();
  if (given) return given;
  // Some locales return only a family name; better than nothing for a greeting.
  return fullName?.familyName?.trim() || '';
}

async function makeNonce() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

/**
 * Run the Apple sheet and sign the user into Supabase.
 *
 * Apple returns fullName and email ONLY on the very first authorization for a
 * given Apple ID + app pair. On every later sign-in both are null, and there is
 * no API to ask again — the user would have to revoke access under Settings →
 * Apple ID → Sign in with Apple. So the name is persisted to user_metadata
 * immediately on that first pass. A later sign-in with both fields null is the
 * normal, expected case: Supabase already holds the email, and the stored
 * first_name is left untouched.
 *
 * Returns { user }. Throws an Error whose `code` is APPLE_CANCELED when the
 * user dismissed the sheet, or APPLE_NOT_CONFIGURED when the entitlement or
 * provider setup is missing.
 */
export async function signInWithApple(supabase) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { raw: rawNonce, hashed: hashedNonce } = await makeNonce();

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      const canceled = new Error('Sign in canceled.');
      canceled.code = APPLE_CANCELED;
      throw canceled;
    }
    // ASAuthorizationError 1000 / "unknown" is what a build without the
    // entitlement reports. Surface something actionable rather than "unknown".
    const notConfigured = new Error(
      'Sign in with Apple is not available in this build yet. Please use email, or update to the latest version.'
    );
    notConfigured.code = APPLE_NOT_CONFIGURED;
    notConfigured.cause = err;
    throw notConfigured;
  }

  if (!credential?.identityToken) {
    throw new Error('Apple did not return an identity token. Please try again.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Present only on first authorization — persist now or lose it permanently.
  const firstName = fullNameToFirstName(credential.fullName);
  if (firstName && !data?.user?.user_metadata?.first_name) {
    try {
      await supabase.auth.updateUser({ data: { first_name: firstName } });
    } catch (err) {
      // Non-fatal: the session is valid, only the greeting name is missing.
      console.warn('Could not save Apple display name:', err?.message || err);
    }
  }

  return { user: data?.user ?? null };
}
