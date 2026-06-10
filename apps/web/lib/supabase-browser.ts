import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return browserClient;
}

export function parseAuthParams(location: Pick<Location, 'hash' | 'search'>) {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const search = location.search.startsWith('?') ? location.search.slice(1) : location.search;
  const params = new URLSearchParams(hash || search);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error_description') || params.get('error'),
  };
}
