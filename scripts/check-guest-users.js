#!/usr/bin/env node

/**
 * Check PostHog for people who used the app but never registered.
 * Uses the HogQL Query API (aggregation), not the raw /events/ endpoint.
 * Usage: node scripts/check-guest-users.js [--days=30] [--limit=50]
 */

const { readFileSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const POSTHOG_HOST = 'https://us.posthog.com';
const PROJECT_ID = '350420';
// Key comes from the environment, or from a key file outside the repo so it
// never lands in git or in shell history. Never put it in .env* — those are
// client-side and EXPO_PUBLIC_* values get inlined into shipped builds.
const KEY_FILE = join(homedir(), '.config', 'posthog', 'personal-key');

function loadKey() {
  if (process.env.POSTHOG_PERSONAL_API_KEY) return process.env.POSTHOG_PERSONAL_API_KEY.trim();
  try {
    return readFileSync(KEY_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

const API_KEY = loadKey();

if (!API_KEY) {
  console.error(
    `No PostHog personal API key found. Either:\n` +
    `  export POSTHOG_PERSONAL_API_KEY=...\n` +
    `  or save the key as the only contents of ${KEY_FILE}\n` +
    `It needs the query:read scope and must start with phx_.`
  );
  process.exit(1);
}

if (API_KEY.startsWith('phc_')) {
  console.error(
    'That is a project API key (phc_), which is write-only and cannot read data.\n' +
    'Create a personal API key instead: Settings -> User -> Personal API keys (starts with phx_).'
  );
  process.exit(1);
}

const arg = (name, fallback) =>
  parseInt((process.argv.find(a => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1], 10);

const days = arg('days', 30);
const limit = arg('limit', 50);

async function hogql(query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) {
    throw new Error(`PostHog API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.results || []).map(row =>
    Object.fromEntries(row.map((v, i) => [data.columns[i], v]))
  );
}

// A person who registered has signup_success; one who signed back in after a
// reinstall has login_success but never re-fires signup. Excluding both leaves
// only people who have never had an account. PostHog's $identify merge (see
// lib/analytics.js setUserId) collapses a guest's pre-auth device profile into
// their authenticated person, so these counts are per-human, not per-install.
const SPLIT = `
SELECT
    count()                                        AS total_people,
    countIf(signups = 0 AND logins = 0)            AS never_registered,
    countIf(signups > 0)                           AS registered,
    countIf(signups = 0 AND logins > 0)            AS returning_signin
FROM (
    SELECT person_id,
           countIf(event = 'signup_success') AS signups,
           countIf(event = 'login_success')  AS logins
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
    GROUP BY person_id
)`;

const GUESTS = `
SELECT person_id,
       min(timestamp)                                     AS first_seen,
       max(timestamp)                                     AS last_seen,
       count()                                            AS events,
       countIf(event = 'explore_as_guest')                AS tapped_explore,
       countIf(event = 'cigar_added')                     AS cigars_added,
       countIf(event = 'guest_signup_prompt_viewed')      AS saw_signup_prompt,
       countIf(event = 'guest_signup_dismissed')          AS dismissed_prompt,
       any(properties.$geoip_city_name)                   AS city,
       any(properties.$geoip_subdivision_1_code)          AS region
FROM events
WHERE timestamp > now() - INTERVAL ${days} DAY
GROUP BY person_id
HAVING countIf(event IN ('signup_success', 'login_success')) = 0
ORDER BY last_seen DESC
LIMIT ${limit}`;

async function main() {
  console.log(`🔍 Guest vs registered users (last ${days}d)…`);

  const [[split], guests] = await Promise.all([hogql(SPLIT), hogql(GUESTS)]);

  const pct = n => (split.total_people ? `${((n / split.total_people) * 100).toFixed(1)}%` : '—');
  console.log(`\n📊 ${split.total_people} people active in the window:`);
  console.log(`   registered (signed up):     ${split.registered} (${pct(split.registered)})`);
  console.log(`   returning (signed back in): ${split.returning_signin} (${pct(split.returning_signin)})`);
  console.log(`   never registered:           ${split.never_registered} (${pct(split.never_registered)})`);

  if (!guests.length) {
    console.log('\n✅ No unregistered users in the window');
    return;
  }

  console.log(`\n👤 ${guests.length} never-registered ${guests.length === 1 ? 'person' : 'people'} (most recent first):\n`);
  for (const g of guests) {
    const where = [g.city, g.region].filter(Boolean).join(', ') || '?';
    const id = `${String(g.person_id).slice(0, 8)}…`;
    const seen = new Date(g.last_seen).toLocaleString();
    const flags = [
      g.tapped_explore ? 'explored' : null,
      g.cigars_added ? `${g.cigars_added} cigar${g.cigars_added === 1 ? '' : 's'}` : null,
      g.saw_signup_prompt ? 'saw prompt' : null,
      g.dismissed_prompt ? 'dismissed prompt' : null,
    ].filter(Boolean).join(', ') || 'no activity beyond screen views';
    console.log(`  ${seen}  ${where.padEnd(22)} ${id}  ${g.events} events  — ${flags}`);
  }

  const engaged = guests.filter(g => g.cigars_added > 0).length;
  const bounced = guests.filter(g => g.saw_signup_prompt && !g.cigars_added).length;
  console.log(`\n   ${engaged} added at least one cigar without registering`);
  console.log(`   ${bounced} saw the signup prompt but never added a cigar`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
