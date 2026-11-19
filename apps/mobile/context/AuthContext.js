import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { isAuthRetryableFetchError } from '@supabase/auth-js';
import { setUserId, initAnalytics, trackEvent } from '../lib/analytics';
import {
  APPLE_CANCELED,
  isAppleAuthAvailable,
  signInWithApple as runAppleSignIn,
} from '../lib/appleAuth';
import { isKnownAuthedUser, isMigrationPending, rememberAuthedUser } from '../lib/authState';
import AsyncStorage from 'expo-sqlite/kv-store';
import { API_BASE_URL } from '../api/config';
import { hydrateUserData } from '../lib/userCigarsSync';
import { isPremiumTestUser } from '../lib/premiumTest';
import { wipeLocalUserData } from '../db';

const GUEST_MODE_KEY = 'cavaro_guest_mode';

/** Non-retryable refresh failures (revoked session, etc.) — clear local auth so user can sign in again. */
function isInvalidRefreshError(error) {
  if (!error || isAuthRetryableFetchError(error)) return false;
  if (error.code === 'refresh_token_not_found') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('refresh token') && (msg.includes('invalid') || msg.includes('not found'));
}

async function recoverFromInvalidRefresh(supabase, error) {
  if (!isInvalidRefreshError(error)) return;
  try {
    await supabase.auth.signOut();
  } catch {
    /* session already cleared */
  }
}

async function sessionFromGetResult(supabase, result) {
  const { data, error } = result;
  if (error) await recoverFromInvalidRefresh(supabase, error);
  return data?.session ?? null;
}

/** getSession() can return stale user_metadata; getUser() loads fresh profile from Auth. */
async function fetchFreshUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    await recoverFromInvalidRefresh(supabase, error);
    return null;
  }
  return data?.user ?? null;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState('free'); // 'free' | 'premium'
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [previewFreeTier, setPreviewFreeTier] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [pendingPremiumSubscribe, setPendingPremiumSubscribe] = useState(false);
  const [signupRequested, setSignupRequested] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  // Staged guest→account migration awaiting user decisions, or null.
  const [migration, setMigration] = useState(null);
  // A pending migration staged for a DIFFERENT account, awaiting explicit
  // confirmation before its destination can change. Never acted on implicitly.
  const [accountConflict, setAccountConflict] = useState(null);

  // onAuthStateChange is registered once with [] deps, so the isGuest it closes
  // over is frozen at its mount value (false). Reading guest state through a ref
  // keeps the SIGNED_IN handler accurate — without it, isGuestMigration is
  // always false and a guest's local cigars are never migrated on sign-up.
  const isGuestRef = useRef(false);

  function applyGuest(flag) {
    isGuestRef.current = flag;
    setIsGuest(flag);
  }

  async function enterGuestMode() {
    applyGuest(true);
    try { await AsyncStorage.setItem(GUEST_MODE_KEY, '1'); } catch {}
  }

  async function exitGuestMode() {
    applyGuest(false);
    try { await AsyncStorage.removeItem(GUEST_MODE_KEY); } catch {}
  }

  async function requestSignup() {
    setSignupRequested(true);
    await exitGuestMode();
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(async (result) => {
        await initAnalytics();
        const guestFlag = await AsyncStorage.getItem(GUEST_MODE_KEY).catch(() => null);
        const session = await sessionFromGetResult(supabase, result);
        const u = session ? await fetchFreshUser(supabase) : null;
        setUser(u);
        setUserId(u?.id ?? null, { email: u?.email });
        if (u) {
          // Authenticated — clear any lingering guest flag
          if (guestFlag) await exitGuestMode();
        } else {
          applyGuest(guestFlag === '1');
        }
        if (session?.access_token) {
          fetchTier(session.access_token, u).then(setTier).catch(() => setTier('free'));
        } else {
          setTier('free');
        }
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setUserId(null);
        setTier('free');
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
      } else if (event === 'USER_UPDATED') {
        setNeedsPasswordReset(false);
      } else if (event === 'SIGNED_OUT') {
        setNeedsPasswordReset(false);
        // Never delete local rows that the server has not confirmed. A guest
        // whose migration failed still has their collection only on device;
        // wiping here would destroy it permanently.
        try {
          if (await isMigrationPending()) {
            console.warn('Keeping local data on sign-out: migration never confirmed');
          } else {
            await wipeLocalUserData();
          }
        } catch {}
        await exitGuestMode();
      }

      const u = session?.user ?? null;
      setUser(u);
      setUserId(u?.id ?? null, { email: u?.email });
      if (session?.access_token) {
        // Capture before exitGuestMode() clears it — the migration below needs it.
        const wasGuest = isGuestRef.current;
        if (wasGuest || event === 'SIGNED_IN') {
          await exitGuestMode();
          setSignupRequested(false);
        }
        try {
          const t = await fetchTier(session.access_token, u);
          setTier(t);
        } catch {
          setTier('free');
        }
        if (event === 'SIGNED_IN') {
          // Keep the known-user record accurate for every auth method, not
          // just Apple, so returning users are never mislabelled as new.
          rememberAuthedUser(u?.id).catch(() => {});
          hydrateUserData(session.access_token, { isGuestMigration: wasGuest, userId: u?.id })
            .catch((err) => console.warn('User data sync failed:', err.message || err))
            .finally(() => { refreshMigrationState(u?.id); });
        }
      } else {
        setTier('free');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    isAppleAuthAvailable().then((ok) => {
      if (active) setAppleAuthAvailable(ok);
    });
    return () => { active = false; };
  }, []);

  /**
   * Re-read the staged migration for a user. Drives the blocking conflict
   * screen and the deferred banner; null when there is nothing outstanding.
   *
   * Scoped by user id, so a run staged for a different account is never shown
   * or applied to whoever is signed in now.
   */
  const refreshMigrationState = React.useCallback(async (forUserId) => {
    const id = forUserId ?? user?.id;
    if (!id) {
      setMigration(null);
      setAccountConflict(null);
      return null;
    }
    try {
      const { getActiveRun, getForeignActiveRun, countUnresolved, PHASE } =
        await import('../lib/guestMigration');
      const run = await getActiveRun(id);

      // No run of our own, but one staged for another account: the guest data
      // on this device belongs to that migration. Surface it for an explicit
      // decision rather than quietly re-pointing it at whoever is signed in.
      if (!run) {
        const foreign = await getForeignActiveRun(id);
        setMigration(null);
        if (foreign) {
          const next = {
            foreignMigrationId: foreign.migration_id,
            foreignUserId: foreign.user_id,
            cigarCount: foreign.guest_snapshot?.length ?? 0,
          };
          setAccountConflict(next);
          return next;
        }
        setAccountConflict(null);
        return null;
      }

      setAccountConflict(null);
      if (run.phase === PHASE.COMPLETED) {
        setMigration(null);
        return null;
      }
      const unresolved = await countUnresolved(run.migration_id);
      if (!unresolved) {
        setMigration(null);
        return null;
      }
      const next = {
        migrationId: run.migration_id,
        userId: run.user_id,
        phase: run.phase,
        deferred: !!run.deferred,
        unresolved,
      };
      setMigration(next);
      return next;
    } catch (err) {
      console.warn('Could not read migration state:', err.message || err);
      return null;
    }
  }, [user?.id]);

  // Pick up an unfinished migration on cold start (app killed mid-resolution).
  useEffect(() => {
    if (user?.id) refreshMigrationState(user.id);
  }, [user?.id, refreshMigrationState]);

  /**
   * Sign in / sign up with Apple. One call covers both: Apple does not
   * distinguish them, and Supabase creates the user on first token exchange.
   *
   * `intent` says which surface the user came from ('signup' for the signup
   * screen and the guest prompt, 'signin' for the login screen) and is only
   * used to label analytics. Nothing functional branches on it: guest
   * migration is driven by the persisted guest-mode flag via isGuestRef, never
   * by whether this looks like a new account.
   *
   * Returns true on success, false if the user canceled. Throws on real
   * failures so the caller can surface a message.
   */
  async function signInWithApple({ intent = 'signin' } = {}) {
    try {
      const { user: appleUser } = await runAppleSignIn(supabase);

      // A user id already recorded on this device is conclusively returning.
      // Otherwise fall back to where the user tapped, which beats guessing
      // from server timestamps. The ambiguous case is a reinstall, where a
      // returning user has no local record and gets labelled by intent.
      const known = await isKnownAuthedUser(appleUser?.id);
      const isNewUser = !known && intent === 'signup';
      await rememberAuthedUser(appleUser?.id);

      // SIGNED_IN fires on the listener above, which handles guest migration,
      // tier refresh and clearing guest mode.
      trackEvent(isNewUser ? 'signup_success' : 'login_success', {
        method: 'apple',
        device_knew_user: known,
        ...(isNewUser ? { tier } : {}),
      });
      return true;
    } catch (err) {
      if (err?.code === APPLE_CANCELED) return false;
      trackEvent('login_failed', { error: err?.message || 'apple_unknown', method: 'apple' });
      throw err;
    }
  }

  // Refresh tier when app comes to foreground (e.g. returning from App Store subscription UI)
  useEffect(() => {
    if (!supabase || !user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchFreshUser(supabase).then((u) => {
          if (u) {
            setUser(u);
            setUserId(u.id);
          }
        });
        supabase.auth.getSession().then(async (result) => {
          const session = await sessionFromGetResult(supabase, result);
          if (session?.access_token) fetchTier(session.access_token, user).then(setTier);
        });
      }
    });
    return () => sub.remove();
  }, [supabase, user]);

  async function fetchTier(accessToken, authUser = user) {
    if (isPremiumTestUser(authUser)) return 'premium';
    const res = await fetch(`${API_BASE_URL}/api/user/tier`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return 'free';
    const data = await res.json().catch(() => ({}));
    return data.tier === 'premium' ? 'premium' : 'free';
  }

  const effectiveTier = previewFreeTier ? 'free' : tier;

  const value = {
    user,
    tier: effectiveTier,
    actualTier: tier,
    loading,
    supabase,
    isGuest,
    enterGuestMode,
    exitGuestMode,
    requestSignup,
    appleAuthAvailable,
    signInWithApple,
    migration,
    accountConflict,
    refreshMigrationState,
    /**
     * Explicitly redirect a pending migration to the signed-in account.
     *
     * Only ever called from the confirmation screen. Reuses the preserved
     * snapshot; the original run is retired, never deleted, and its snapshot
     * is copied forward rather than re-read from local rows.
     */
    confirmMigrationAccountChange: async () => {
      if (!user?.id || !accountConflict?.foreignMigrationId) {
        return { ok: false, reason: 'nothing_to_confirm' };
      }
      const result = await supabase.auth.getSession();
      const session = await sessionFromGetResult(supabase, result);
      if (!session?.access_token) return { ok: false, reason: 'no_session' };
      try {
        const { confirmAccountChange } = await import('../lib/guestMigration');
        await confirmAccountChange(accountConflict.foreignMigrationId, user.id, session.access_token);
        trackEvent('migration_account_change_confirmed');
        await refreshMigrationState(user.id);
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message || 'failed' };
      }
    },
    /**
     * Finish a staged migration once every conflict is resolved: apply locally,
     * sync, confirm, then clear the pending flag.
     */
    finishMigration: async () => {
      if (!user?.id) return { ok: false, reason: 'no_user' };
      const result = await supabase.auth.getSession();
      const session = await sessionFromGetResult(supabase, result);
      if (!session?.access_token) return { ok: false, reason: 'no_session' };
      const { runGuestMigration } = await import('../lib/userCigarsSync');
      try {
        const outcome = await runGuestMigration(session.access_token, user.id);
        await refreshMigrationState(user.id);
        return { ok: outcome?.phase === 'completed', outcome };
      } catch (err) {
        await refreshMigrationState(user.id);
        return { ok: false, reason: err.message || 'failed' };
      }
    },
    signupRequested,
    clearSignupRequested: () => setSignupRequested(false),
    needsPasswordReset,
    clearPasswordReset: () => setNeedsPasswordReset(false),
    previewFreeTier,
    setPreviewFreeTier,
    refreshTier: async () => {
      if (!user || !supabase) return;
      const result = await supabase.auth.getSession();
      const session = await sessionFromGetResult(supabase, result);
      if (session?.access_token) fetchTier(session.access_token, user).then(setTier);
    },
    setTierFromSubscription: (newTier) => {
      if (newTier === 'premium') setTier('premium');
    },
    pendingPremiumSubscribe,
    setPendingPremiumSubscribe,
    clearPendingPremiumSubscribe: () => setPendingPremiumSubscribe(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
