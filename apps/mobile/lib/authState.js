/**
 * Small persisted facts about authentication on this device.
 *
 * Two things live here, both deliberately on disk rather than inferred:
 *
 *  - Which Supabase user ids have completed auth on this device. Used to tell a
 *    brand new account from a returning one without comparing server
 *    timestamps, which are not a reliable account-creation signal (created_at
 *    and last_sign_in_at can land within the same tick, and sign-in metadata
 *    changes over time).
 *
 *  - Whether a guest→account migration is still unconfirmed. Local rows must
 *    not be deleted while this is set; see wipeLocalUserData's caller.
 */

import AsyncStorage from 'expo-sqlite/kv-store';

const KNOWN_USERS_KEY = 'cavaro_known_user_ids';
const MIGRATION_PENDING_KEY = 'cavaro_migration_pending';
const MAX_REMEMBERED = 10;

async function readKnownUsers() {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Has this user id authenticated on this device before?
 *
 * A false here means "no local record", which is conclusive for a returning
 * user on the same install but not across a reinstall — a reinstalling user
 * looks unknown. Callers combine this with the UI intent rather than treating
 * it as proof of account creation.
 */
export async function isKnownAuthedUser(userId) {
  if (!userId) return false;
  return (await readKnownUsers()).includes(userId);
}

export async function rememberAuthedUser(userId) {
  if (!userId) return;
  try {
    const known = await readKnownUsers();
    if (known.includes(userId)) return;
    const next = [userId, ...known].slice(0, MAX_REMEMBERED);
    await AsyncStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(next));
  } catch {
    /* best effort — only affects analytics labelling */
  }
}

/**
 * Mark that local rows exist which the server has not confirmed yet. Set when a
 * guest migration begins, cleared only once the push succeeds.
 */
export async function markMigrationPending() {
  try { await AsyncStorage.setItem(MIGRATION_PENDING_KEY, '1'); } catch {}
}

export async function clearMigrationPending() {
  try { await AsyncStorage.removeItem(MIGRATION_PENDING_KEY); } catch {}
}

/**
 * True when a migration started but never confirmed. Treated as "local data is
 * the only copy" — fail safe by returning true if the read itself fails, since
 * the cost of a wrong false is permanent data loss.
 */
export async function isMigrationPending() {
  try {
    return (await AsyncStorage.getItem(MIGRATION_PENDING_KEY)) === '1';
  } catch {
    return true;
  }
}
