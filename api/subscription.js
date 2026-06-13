import { API_BASE_URL } from './config';
import {
  cancelIapPurchaseWaiters,
  getActivePremiumPurchaseIfOwned,
  restoreAppleSubscription,
  isIapAvailable,
  isIapAlreadyOwned,
  premiumUnavailableMessage,
  requestPremiumPurchase,
  syncPremiumAfterAlreadyOwned,
  waitForIapPurchaseResult,
  whenIapReady,
} from '../lib/iap';

/**
 * Check if subscription verification is configured on the server.
 * Returns { configured: boolean, missing: string[] }
 */
export async function getSubscriptionStatus() {
  const res = await fetch(`${API_BASE_URL}/api/subscription/status`);
  if (res.status === 404) {
    throw new Error(
      `Status endpoint not found (404). The server at ${API_BASE_URL} may be outdated. ` +
        'Deploy the latest server code, or ensure EXPO_PUBLIC_API_URL is correct.'
    );
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned invalid JSON (${res.status}). Check ${API_BASE_URL}/api/subscription/status in a browser.`);
  }
  return {
    configured: !!data.configured,
    missing: Array.isArray(data.missing) ? data.missing : [],
  };
}

/**
 * Start Apple IAP purchase (iOS). When { started: true }, await outcomePromise for completion/cancel.
 */
async function syncAlreadyOwnedPremium(accessToken) {
  const restoreResult = await syncPremiumAfterAlreadyOwned(accessToken);
  return { alreadyOwned: true, restoreResult };
}

export async function subscribeOrManage(accessToken, tier, userId) {
  if (tier === 'premium') {
    return { alreadySubscribed: true };
  }
  if (!isIapAvailable()) {
    return { unavailable: true, message: premiumUnavailableMessage() };
  }

  const ready = await whenIapReady();
  if (!ready) {
    throw new Error(
      'Could not connect to the App Store. Check your network and Apple ID under Settings, then try again.',
    );
  }

  // Avoid StoreKit "already-owned" when Apple ID already has our subscription product.
  const ownedPurchase = await getActivePremiumPurchaseIfOwned();
  if (ownedPurchase) {
    return syncAlreadyOwnedPremium(accessToken);
  }

  try {
    await requestPremiumPurchase(userId);
  } catch (e) {
    if (isIapAlreadyOwned(e)) {
      return syncAlreadyOwnedPremium(accessToken);
    }
    cancelIapPurchaseWaiters();
    throw e;
  }

  const outcomePromise = waitForIapPurchaseResult();
  return { started: true, outcomePromise };
}

/**
 * Restore Apple subscription and sync tier with the server.
 */
export async function restoreSubscription(accessToken) {
  try {
    if (isIapAvailable()) {
      const ready = await whenIapReady();
      if (!ready) {
        return {
          tier: 'free',
          restored: false,
          error:
            'Could not connect to the App Store. Check your network and Apple ID under Settings, then try again.',
        };
      }
    }
    return await restoreAppleSubscription(accessToken);
  } catch (e) {
    return {
      tier: 'free',
      restored: false,
      error: e.message || 'Could not sync subscription with the server.',
    };
  }
}
