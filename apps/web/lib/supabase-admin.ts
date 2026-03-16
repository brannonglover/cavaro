import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return adminClient;
}
