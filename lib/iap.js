import { Platform, Alert, Linking, DeviceEventEmitter } from 'react-native';
import { API_BASE_URL } from '../api/config';
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

export async function initIapConnection() {
  const iap = getIapModule();
  if (!iap) return false;
  try {
    await iap.initConnection();
    return true;
  } catch (e) {
    console.warn('IAP initConnection:', e);
    return false;
  }
}

export async function fetchPremiumProduct() {
  const iap = getIapModule();
  if (!iap) return null;
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
  await iap.initConnection();
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

export async function verifyAppleTransaction(accessToken, transactionId) {
  const res = await fetch(`${API_BASE_URL}/api/subscription/apple/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ transactionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not verify subscription');
  }
  return data.tier === 'premium' ? 'premium' : null;
}

async function syncAppleRestore(accessToken, body = {}) {
  const res = await fetch(`${API_BASE_URL}/api/subscription/apple/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Restore failed');
  return {
    tier: data.tier === 'premium' ? 'premium' : 'free',
    restored: !!data.restored,
  };
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
    throw new Error('Restore is available on the Cavaro iOS app.');
  }

  await initIapConnection();

  let list = [];
  let storeKitError = null;

  try {
    await iap.restorePurchases();
  } catch (e) {
    console.warn('IAP restorePurchases:', e);
    storeKitError = e;
  }

  try {
    const purchases = await iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    list = Array.isArray(purchases) ? purchases : [];
  } catch (e) {
    console.warn('IAP getAvailablePurchases:', e);
    if (!storeKitError) storeKitError = e;
  }

  const premium = list.find((p) => p.productId === IOS_PREMIUM_PRODUCT_ID);

  try {
    if (premium) {
      const tid = premium.transactionId || premium.transactionIdentifierIOS || premium.id;
      return await syncAppleRestore(accessToken, { transactionId: tid });
    }
    return await syncAppleRestore(accessToken, {});
  } catch (serverErr) {
    if (storeKitError) {
      throw new Error(friendlyStoreKitError(storeKitError));
    }
    throw serverErr;
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

/**
 * Resolves when the user finishes, cancels, or fails an IAP started by requestPremiumPurchase.
 * Call and await after subscribeOrManage returns { started: true }.
 */
export function waitForIapPurchaseResult() {
  return new Promise((resolve) => {
    const c = DeviceEventEmitter.addListener('iapPurchaseCompleted', () => finish('completed'));
    const f = DeviceEventEmitter.addListener('iapPurchaseFailed', ({ message }) => finish('failed', message));
    const x = DeviceEventEmitter.addListener('iapPurchaseCancelled', () => finish('cancelled'));
    function finish(status, message) {
      c.remove();
      f.remove();
      x.remove();
      resolve({ status, message });
    }
  });
}
