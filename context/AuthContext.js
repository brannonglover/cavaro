import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { isAuthRetryableFetchError } from '@supabase/auth-js';
import { setUserId } from '../lib/analytics';
import AsyncStorage from 'expo-sqlite/kv-store';
import { API_BASE_URL } from '../api/config';

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
  const [previewFreeTier, setPreviewFreeTier] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [pendingPremiumSubscribe, setPendingPremiumSubscribe] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(async (result) => {
        const session = await sessionFromGetResult(supabase, result);
        const u = session?.user ?? null;
        setUser(u);
        setUserId(u?.id ?? null);
        if (session?.access_token) {
          fetchTier(session.access_token).then(setTier).catch(() => setTier('free'));
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
      }

      const u = session?.user ?? null;
      setUser(u);
      setUserId(u?.id ?? null);
      if (session?.access_token) {
        try {
          const t = await fetchTier(session.access_token);
          setTier(t);
        } catch {
          setTier('free');
        }
      } else {
        setTier('free');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh tier when app comes to foreground (e.g. returning from App Store subscription UI)
  useEffect(() => {
    if (!supabase || !user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.getSession().then(async (result) => {
          const session = await sessionFromGetResult(supabase, result);
          if (session?.access_token) fetchTier(session.access_token).then(setTier);
        });
      }
    });
    return () => sub.remove();
  }, [supabase, user]);

  async function fetchTier(accessToken) {
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
    needsPasswordReset,
    clearPasswordReset: () => setNeedsPasswordReset(false),
    previewFreeTier,
    setPreviewFreeTier,
    refreshTier: async () => {
      if (!user || !supabase) return;
      const result = await supabase.auth.getSession();
      const session = await sessionFromGetResult(supabase, result);
      if (session?.access_token) fetchTier(session.access_token).then(setTier);
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
