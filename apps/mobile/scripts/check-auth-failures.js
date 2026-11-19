#!/usr/bin/env node

/**
 * Check PostHog for recent login_failed and signup_failed events.
 * Usage: node scripts/check-auth-failures.js [--hours=24]
 */

const POSTHOG_HOST = 'https://us.posthog.com';
const PROJECT_ID = '350420';
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

if (!API_KEY) {
  console.error('Set POSTHOG_PERSONAL_API_KEY env var');
  process.exit(1);
}

const hours = parseInt((process.argv.find(a => a.startsWith('--hours=')) || '--hours=24').split('=')[1], 10);

async function fetchEvents(eventName) {
  const res = await fetch(
    `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/events/?event=${eventName}&limit=50`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostHog API ${res.status}: ${body}`);
  }
  const data = await res.json();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return (data.results || []).filter(e => new Date(e.timestamp) >= cutoff);
}

function summarize(events, label) {
  if (!events.length) {
    console.log(`\n✅ No ${label} events in the last ${hours}h`);
    return;
  }
  console.log(`\n⚠️  ${events.length} ${label} event(s) in the last ${hours}h:\n`);
  for (const e of events) {
    const ts = new Date(e.timestamp).toLocaleString();
    const city = e.properties?.$geoip_city_name || '?';
    const state = e.properties?.$geoip_subdivision_1_code || '';
    const error = e.properties?.error || e.properties?.reason || '—';
    const deviceId = e.distinct_id?.slice(0, 8) + '…';
    console.log(`  ${ts}  ${city}, ${state}  device=${deviceId}  error="${error}"`);
  }
}

async function main() {
  console.log(`🔍 Checking auth failures (last ${hours}h)…`);
  const [loginFails, signupFails] = await Promise.all([
    fetchEvents('login_failed'),
    fetchEvents('signup_failed'),
  ]);
  summarize(loginFails, 'login_failed');
  summarize(signupFails, 'signup_failed');

  const devices = new Set([...loginFails, ...signupFails].map(e => e.distinct_id));
  if (devices.size) {
    console.log(`\n📊 ${devices.size} unique device(s) affected`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
