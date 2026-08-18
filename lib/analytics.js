/**
 * Analytics service for tracking screen views and feature usage.
 * Uses PostHog's capture API when EXPO_PUBLIC_POSTHOG_KEY is set.
 * No-op when not configured (safe for local dev).
 */

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let distinctId = null;

/**
 * Set the distinct user ID (e.g. Supabase user id). Call after auth.
 */
export function setUserId(userId) {
  distinctId = userId;
}

/**
 * Track a screen view (tab or stack screen).
 */
export function trackScreen(screenName, params = {}) {
  capture('screen_view', { screen: screenName, ...params });
}

/**
 * Track a feature/action event.
 */
export function trackEvent(eventName, properties = {}) {
  capture(eventName, properties);
}

/**
 * Track a cigar saved to a humidor. `cigar` is the breakdown key for popularity.
 */
export function trackCigarAdded({ source, brand, name, line, length, quantity }) {
  const trimmedBrand = (brand || '').trim();
  const trimmedName = (name || '').trim();
  const trimmedLine = (line || '').trim();
  const trimmedLength = (length || '').trim();
  const cigar = [trimmedBrand, trimmedLine, trimmedName].filter(Boolean).join(' ');

  trackEvent('cigar_added', {
    source,
    brand: trimmedBrand,
    name: trimmedName,
    line: trimmedLine || undefined,
    length: trimmedLength,
    quantity: Number(quantity) || 1,
    cigar,
  });
}

function capture(event, properties = {}) {
  if (!POSTHOG_KEY) {
    if (__DEV__) {
      console.warn('[analytics] EXPO_PUBLIC_POSTHOG_KEY is not set; events are not sent');
    }
    return;
  }

  const payload = {
    api_key: POSTHOG_KEY,
    event,
    distinct_id: distinctId || 'anonymous',
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      $lib: 'cavaro-analytics',
    },
  };

  fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    if (__DEV__) {
      console.warn('[analytics] PostHog capture failed', err);
    }
  });
}
