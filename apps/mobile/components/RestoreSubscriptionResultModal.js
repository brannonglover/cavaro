import React from 'react';
import ConfirmModal from './ConfirmModal';
import { premiumUnavailableMessage } from '../lib/iap';

export function isRestoreTechnicalError(message) {
  if (!message) return false;
  const msg = message.toLowerCase();
  if (msg.includes('available on the cavaro ios app')) return false;
  if (msg.includes('not available on this platform')) return false;
  return (
    /network|fetch|timeout|couldn't communicate|service-error|helper application|not configured|invalid json|server returned|could not sync|unauthorized|503|500/i.test(
      msg
    ) ||
    msg.includes('could not reach the app store') ||
    msg.includes('could not verify') ||
    msg.includes('missing transaction') ||
    msg.includes('app store key') ||
    msg.includes('misconfigured') ||
    /asymmetric key|es256|invalid for es256|truncated|must be the full/i.test(msg)
  );
}

export function getSubscribeFailureAlert(message, options = {}) {
  const msg = message || 'Could not complete purchase.';
  if (
    options.alreadyOwned ||
    /already owned|already-owned/i.test(msg)
  ) {
    return {
      title: 'Premium not activated yet',
      message: isRestoreTechnicalError(msg)
        ? msg
        : 'Your Apple ID already has this subscription, but Cavaro could not activate Premium yet. Tap Restore subscription to sync once you are online.',
      variant: 'warning',
    };
  }
  if (isRestoreTechnicalError(msg)) {
    return {
      title: /app store key|misconfigured|asymmetric key|es256/i.test(msg)
        ? 'Server setup needed'
        : 'Premium not activated yet',
      message: msg,
      variant: 'warning',
    };
  }
  return {
    title: 'Subscription',
    message: msg,
    variant: 'warning',
  };
}

export function getRestoreSubscriptionAlert(result) {
  if (!result || result.cancelled) return null;

  if (result.unavailable) {
    return {
      title: 'Premium on iOS',
      message: premiumUnavailableMessage(),
      variant: 'default',
    };
  }

  if (result.error) {
    if (isRestoreTechnicalError(result.error)) {
      return {
        title: /app store|storekit|media & purchases/i.test(result.error)
          ? "Couldn't connect to the App Store"
          : 'Something went wrong',
        message:
          result.error ||
          "We had trouble completing the restore. Check your connection and try again.",
        variant: 'warning',
      };
    }
    return {
      title: 'No subscription found',
      message:
        "We couldn't find an active Premium subscription for this Apple ID and Cavaro account. " +
        "Make sure you're signed in with the same Apple ID you used to subscribe " +
        '(Settings → Apple ID → Media & Purchases). If you just subscribed, wait a moment and try again.',
      variant: 'default',
    };
  }

  if (result.restored) {
    return {
      title: 'Welcome back',
      message: 'Your Premium subscription has been restored.',
      variant: 'default',
    };
  }

  if (result.tier === 'premium') {
    return {
      title: 'Already subscribed',
      message: 'Premium is already active on this account.',
      variant: 'default',
    };
  }

  return {
    title: 'No subscription found',
    message:
      "We couldn't find an active Premium subscription for this Apple ID and Cavaro account. " +
      "Make sure you're signed in with the same Apple ID you used to subscribe " +
      '(Settings → Apple ID → Media & Purchases). If you just subscribed, wait a moment and try again.',
    variant: 'default',
  };
}

export default function RestoreSubscriptionResultModal({ alert, onClose }) {
  if (!alert) return null;
  return (
    <ConfirmModal
      visible
      title={alert.title}
      message={alert.message}
      variant={alert.variant || 'default'}
      onClose={onClose}
      buttons={[{ text: 'OK', style: 'cancel', onPress: onClose }]}
    />
  );
}
