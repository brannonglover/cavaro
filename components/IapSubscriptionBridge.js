import { useEffect, useRef } from 'react';
import { Platform, AppState, DeviceEventEmitter } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { IOS_PREMIUM_PRODUCT_ID } from '../constants/iap';
import {
  verifyAppleTransaction,
  ensureIapConnection,
  refreshIapConnectionOnResume,
  isIapAlreadyOwned,
  isIapUserCancelled,
  syncPremiumAfterAlreadyOwned,
} from '../lib/iap';

function getIapModule() {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('react-native-iap');
  } catch {
    return null;
  }
}

function isPremiumPurchaseError(err) {
  if (!err?.productId) return true;
  return err.productId === IOS_PREMIUM_PRODUCT_ID;
}

async function handleAlreadyOwnedPurchase(supabase, setTierFromSubscription, refreshTier) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    DeviceEventEmitter.emit('iapPurchaseFailed', { message: 'Sign in required' });
    return;
  }
  const restoreResult = await syncPremiumAfterAlreadyOwned(session.access_token);
  if (restoreResult.tier === 'premium' || restoreResult.restored) {
    setTierFromSubscription?.('premium');
    await refreshTier?.();
    DeviceEventEmitter.emit('iapPurchaseCompleted');
    return;
  }
  DeviceEventEmitter.emit('iapPurchaseFailed', {
    message:
      restoreResult.error ||
      'Your Apple ID already has Premium, but Cavaro could not activate it yet. Tap Restore subscription to try again.',
    alreadyOwned: true,
    restoreResult,
  });
}

/**
 * Initializes StoreKit and verifies purchases when the user completes checkout.
 */
export default function IapSubscriptionBridge() {
  const { user, supabase, refreshTier, setTierFromSubscription } = useAuth();
  const processedTransactionsRef = useRef(new Set());
  const alreadyOwnedSyncRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const iap = getIapModule();
    if (!iap) return undefined;

    let purchaseSub;
    let errorSub;

    (async () => {
      const ready = await ensureIapConnection();
      if (!ready) return;
      purchaseSub = iap.purchaseUpdatedListener(async (purchase) => {
        if (purchase.productId !== IOS_PREMIUM_PRODUCT_ID) return;
        const tid = purchase.transactionId || purchase.id;
        if (!tid) {
          DeviceEventEmitter.emit('iapPurchaseFailed', { message: 'Missing transaction' });
          return;
        }
        if (processedTransactionsRef.current.has(tid)) return;
        processedTransactionsRef.current.add(tid);

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            DeviceEventEmitter.emit('iapPurchaseFailed', { message: 'Sign in required' });
            return;
          }
          await verifyAppleTransaction(session.access_token, tid);
          try {
            await iap.finishTransaction({ purchase });
          } catch (fe) {
            DeviceEventEmitter.emit('iapPurchaseFailed', {
              message: fe?.message || 'Could not finish transaction with App Store',
            });
            return;
          }
          setTierFromSubscription?.('premium');
          await refreshTier?.();
          DeviceEventEmitter.emit('iapPurchaseCompleted');
        } catch (e) {
          const message = e?.message || String(e);
          if (__DEV__) console.warn('IAP verify:', message);
          DeviceEventEmitter.emit('iapPurchaseFailed', { message });
        }
      });

      errorSub = iap.purchaseErrorListener(async (err) => {
        if (isIapUserCancelled(err)) {
          DeviceEventEmitter.emit('iapPurchaseCancelled');
          return;
        }
        if (isIapAlreadyOwned(err)) {
          if (alreadyOwnedSyncRef.current) {
            await alreadyOwnedSyncRef.current;
            return;
          }
          alreadyOwnedSyncRef.current = handleAlreadyOwnedPurchase(
            supabase,
            setTierFromSubscription,
            refreshTier
          ).finally(() => {
            alreadyOwnedSyncRef.current = null;
          });
          await alreadyOwnedSyncRef.current;
          return;
        }
        if (!isPremiumPurchaseError(err)) return;
        if (__DEV__) console.warn('IAP purchase error:', err);
        DeviceEventEmitter.emit('iapPurchaseFailed', { message: err?.message || 'Purchase failed' });
      });
    })();

    return () => {
      purchaseSub?.remove();
      errorSub?.remove();
    };
  }, [supabase, refreshTier, setTierFromSubscription]);

  // Reconnect StoreKit and refresh tier when returning from background / App Store UI
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshIapConnectionOnResume().catch(() => {});
      if (user && supabase) refreshTier?.();
    });
    return () => sub.remove();
  }, [user, supabase, refreshTier]);

  return null;
}
