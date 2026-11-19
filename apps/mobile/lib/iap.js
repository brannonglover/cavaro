import { Platform, Alert, Linking, DeviceEventEmitter } from 'react-native';
import { API_BASE_URL, formatFetchReachabilityError } from '../api/config';
import { IOS_PREMIUM_PRODUCT_ID } from '../constants/iap';

function getIapModule() {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('react-native-iap');
  } catch {
    return null;
  }
}

export function isIapAvailable() {
  return Platform.OS === 'ios' && !!getIapModule();
}

let iapReadyPromise = null;

function resetIapReadyPromise() {
  iapReadyPromise = null;
}

async function connectIapWithRetry(maxAttempts = 3) {
  const iap = getIapModule();
  if (!iap) return false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await iap.initConnection();
      if (result === false) {
        throw new Error('initConnection returned false');
      }
      return true;
    } catch (e) {
      if (__DEV__) {
        console.warn(`IAP initConnection attempt ${attempt}/${maxAttempts}:`, e?.message || e);
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }
  return false;
}

/** Ensures StoreKit is connected; dedupes concurrent callers and retries transient failures. */
export async function ensureIapConnection() {
  if (Platform.OS !== 'ios') return false;
  if (iapReadyPromise) return iapReadyPromise;

  iapReadyPromise = connectIapWithRetry().then((ok) => {
    if (!ok) resetIapReadyPromise();
    return ok;
  });

  return iapReadyPromise;
}

/** Gate subscribe/restore flows until StoreKit is ready. */
export const whenIapReady = ensureIapConnection;

export async function initIapConnection() {
  return ensureIapConnection();
}

/** Call when the app resumes so a dropped StoreKit session can reconnect. */
export function markIapConnectionStale() {
  resetIapReadyPromise();
}

export async function refreshIapConnectionOnResume() {
  if (Platform.OS !== 'ios') return false;
  markIapConnectionStale();
  return ensureIapConnection();
}

export async function fetchPremiumProduct() {
  const iap = getIapModule();
  if (!iap) return null;
  const ready = await ensureIapConnection();
  if (!ready) return null;
  const products = await iap.fetchProducts({ skus: [IOS_PREMIUM_PRODUCT_ID], type: 'subs' });
  const list = Array.isArray(products) ? products : [];
  return list.find((p) => p.id === IOS_PREMIUM_PRODUCT_ID) || list[0] || null;
}

/**
 * Starts the Apple subscription purchase (StoreKit). Completion is delivered via purchase listener.
 * Ensures a live StoreKit connection and loads the subscription product before purchasing.
 */
export async function requestPremiumPurchase(userId) {
  const iap = getIapModule();
  if (!iap) {
    throw new Error('Subscriptions are available on the Cavaro iOS app.');
  }
  const ready = await ensureIapConnection();
  if (!ready) {
    throw new Error(
      'Could not connect to the App Store. Check your network and Apple ID under Settings, then try again.',
    );
  }
  const product = await fetchPremiumProduct();
  if (!product) {
    throw new Error(
      `Subscription product not found (${IOS_PREMIUM_PRODUCT_ID}). ` +
        'Check App Store Connect: the subscription must have a price, ' +
        'at least one localization, and a status of Ready to Submit or Approved. ' +
        'Also verify the Paid Applications agreement is active under Business > Agreements.',
    );
  }
  await iap.requestPurchase({
    type: 'subs',
    request: {
      apple: {
        sku: IOS_PREMIUM_PRODUCT_ID,
        appAccountToken: userId,
      },
    },
  });
}

function friendlyAppleServerError(message) {
  const msg = message || '';
  if (/asymmetric key|ES256|invalid for ES256|truncated|must be the full|not configured on the server/i.test(msg)) {
    return (
      'Cavaro could not activate Premium because the server App Store key is misconfigured. ' +
      'If you are testing locally, set APP_STORE_PRIVATE_KEY to the full .p8 contents in server/.env and restart the server. ' +
      'If Apple already charged you, tap Restore subscription after the server is fixed.'
    );
  }
  return msg;
}

export async function verifyAppleTransaction(accessToken, transactionId) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/subscription/apple/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ transactionId }),
    });
  } catch (err) {
    throw new Error(
      `${formatFetchReachabilityError(err, 'sync your subscription with the server')} ` +
        'If Apple showed success, tap Restore subscription to try again.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(friendlyAppleServerError(data.error || 'Could not verify subscription'));
  }
  return data.tier === 'premium' ? 'premium' : null;
}

async function syncAppleRestore(accessToken, body = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/subscription/apple/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(formatFetchReachabilityError(err, 'sync your subscription with the server'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(friendlyAppleServerError(data.error || 'Could not sync subscription with the server.'));
  }
  return {
    tier: data.tier === 'premium' ? 'premium' : 'free',
    restored: !!data.restored,
  };
}

export function isIapUserCancelled(e) {
  if (!e) return false;
  const code = e?.code;
  if (code === 'E_USER_CANCELLED' || code === 'user-cancelled') return true;
  const msg = (e?.message || String(e)).toLowerCase();
  return (
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('request cancelled') ||
    msg.includes('request canceled') ||
    msg.includes('skerrorpaymentcancelled') ||
    msg.includes('payment was cancelled') ||
    msg.includes('payment was canceled')
  );
}

export function isIapAlreadyOwned(e) {
  if (!e) return false;
  const code = e?.code;
  if (code === 'already-owned' || code === 'E_ALREADY_OWNED') return true;
  const msg = (e?.message || String(e)).toLowerCase();
  return msg.includes('already owned') || msg.includes('already-owned');
}

let alreadyOwnedSyncInFlight = null;

/** Sync Cavaro with an Apple subscription StoreKit already owns (deduped). */
export async function syncPremiumAfterAlreadyOwned(accessToken) {
  if (alreadyOwnedSyncInFlight) return alreadyOwnedSyncInFlight;
  alreadyOwnedSyncInFlight = restoreAppleSubscription(accessToken).finally(() => {
    alreadyOwnedSyncInFlight = null;
  });
  return alreadyOwnedSyncInFlight;
}

function friendlyStoreKitError(e) {
  const msg = e?.message || String(e);
  if (/service-error|helper application|Couldn't communicate/i.test(msg)) {
    return 'Could not reach the App Store. Make sure you are signed in under Settings → Apple ID → Media & Purchases, then try again.';
  }
  return msg;
}

export async function restoreAppleSubscription(accessToken) {
  const iap = getIapModule();
  if (!iap) {
    return { tier: 'free', restored: false, unavailable: true };
  }

  await initIapConnection();

  let list = [];
  let storeKitError = null;
  let userCancelledRestore = false;

  try {
    await iap.restorePurchases();
  } catch (e) {
    console.warn('IAP restorePurchases:', e);
    if (isIapUserCancelled(e)) {
      userCancelledRestore = true;
    } else {
      storeKitError = e;
    }
  }

  try {
    const purchases = await iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    list = Array.isArray(purchases) ? purchases : [];
  } catch (e) {
    console.warn('IAP getAvailablePurchases:', e);
    if (isIapUserCancelled(e)) {
      userCancelledRestore = true;
    } else if (!storeKitError) {
      storeKitError = e;
    }
  }

  const premium = list.find((p) => p.productId === IOS_PREMIUM_PRODUCT_ID);

  try {
    let result;
    if (premium) {
      const tid = premium.transactionId || premium.transactionIdentifierIOS || premium.id;
      result = await syncAppleRestore(accessToken, { transactionId: tid });
    } else {
      result = await syncAppleRestore(accessToken, {});
    }

    if (userCancelledRestore && !result.restored && result.tier !== 'premium') {
      return { ...result, cancelled: true };
    }
    return result;
  } catch (serverErr) {
    if (userCancelledRestore || isIapUserCancelled(storeKitError)) {
      return { tier: 'free', restored: false, cancelled: true };
    }
    if (storeKitError) {
      return { tier: 'free', restored: false, error: friendlyStoreKitError(storeKitError) };
    }
    return {
      tier: 'free',
      restored: false,
      error: serverErr?.message || 'Could not sync subscription with the server.',
    };
  }
}

export async function openManageSubscriptions() {
  if (Platform.OS === 'ios') {
    const iap = getIapModule();
    if (iap?.showManageSubscriptionsIOS) {
      try {
        await iap.showManageSubscriptionsIOS();
        return;
      } catch (e) {
        console.warn('showManageSubscriptionsIOS:', e);
      }
    }
  }
  await Linking.openURL('https://apps.apple.com/account/subscriptions');
}

export function premiumUnavailableMessage() {
  if (Platform.OS === 'android') {
    return 'Premium is available on the Cavaro app for iPhone and iPad.';
  }
  return 'Subscriptions are not available on this platform.';
}

export function alertPremiumUnavailable() {
  Alert.alert('Premium', premiumUnavailableMessage());
}

/** Active StoreKit premium subscription, if Apple already owns it. */
export async function getActivePremiumPurchaseIfOwned() {
  const iap = getIapModule();
  if (!iap) return null;
  await initIapConnection();
  try {
    const purchases = await iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    const list = Array.isArray(purchases) ? purchases : [];
    return list.find((p) => p.productId === IOS_PREMIUM_PRODUCT_ID) || null;
  } catch (e) {
    if (__DEV__ && !isIapUserCancelled(e)) {
      console.warn('IAP getAvailablePurchases:', e?.message || e);
    }
    return null;
  }
}

/** Unblocks any waitForIapPurchaseResult listener (e.g. after synchronous purchase failure). */
export function cancelIapPurchaseWaiters() {
  DeviceEventEmitter.emit('iapPurchaseCancelled');
}

/**
 * Resolves when the user finishes, cancels, or fails an IAP started by requestPremiumPurchase.
 * Call and await after subscribeOrManage returns { started: true }.
 */
export function waitForIapPurchaseResult({ timeoutMs = 120000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const c = DeviceEventEmitter.addListener('iapPurchaseCompleted', () => finish('completed'));
    const f = DeviceEventEmitter.addListener('iapPurchaseFailed', (payload) =>
      finish('failed', payload?.message, payload)
    );
    const x = DeviceEventEmitter.addListener('iapPurchaseCancelled', () => finish('cancelled'));
    const timer =
      timeoutMs > 0
        ? setTimeout(
            () =>
              finish('failed', 'Purchase timed out. Tap Restore subscription if you were charged.'),
            timeoutMs
          )
        : null;

    function finish(status, message, payload = {}) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      c.remove();
      f.remove();
      x.remove();
      resolve({
        status,
        message,
        alreadyOwned: !!payload?.alreadyOwned,
        restoreResult: payload?.restoreResult,
      });
    }
  });
}
