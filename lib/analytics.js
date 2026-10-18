/**
 * Analytics service for tracking screen views and feature usage.
 * Uses PostHog's capture API when EXPO_PUBLIC_POSTHOG_KEY is set.
 * No-op when not configured (safe for local dev).
 */

import AsyncStorage from 'expo-sqlite/kv-store';
import { buildCigarKey } from './addCigarValidation';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const ANON_ID_KEY = 'cavaro_anon_id';

let distinctId = null;
let anonId = null;
let initPromise = null;

function generateId() {
  const hex = '0123456789abcdef';
  const seg = (n) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${hex[8 + Math.floor(Math.random() * 4)]}${seg(3)}-${seg(12)}`;
}

/**
 * Load or create a persistent anonymous device ID. Call once at app startup.
 * Safe to call multiple times — only the first call does I/O.
 */
export function initAnalytics() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      let stored = await AsyncStorage.getItem(ANON_ID_KEY);
      if (!stored) {
        stored = generateId();
        await AsyncStorage.setItem(ANON_ID_KEY, stored);
      }
      anonId = stored;
    } catch {
      anonId = generateId();
    }
  })();
  return initPromise;
}

/**
 * Set the distinct user ID (e.g. Supabase user id). Call after auth.
 * Sends a PostHog $identify event to merge the anonymous device profile
 * into the authenticated user profile, and sets person properties (email)
 * so the user is filterable in PostHog.
 */
export function setUserId(userId, { email } = {}) {
  const previousId = distinctId;
  distinctId = userId;

  if (userId && anonId && previousId !== userId) {
    capture('$identify', {
      $anon_distinct_id: anonId,
      distinct_id: userId,
      $set: {
        ...(email ? { email } : {}),
      },
    });
  }
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
  const cigar = buildCigarKey({ brand: trimmedBrand, line: trimmedLine, name: trimmedName });

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
    distinct_id: distinctId || anonId || 'anonymous',
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
