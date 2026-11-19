import { API_BASE_URL } from './config';

/**
 * Permanently delete the authenticated user's account (server + Supabase Auth).
 * Requires a valid Supabase access token.
 */
export async function deleteAccount(accessToken) {
  const res = await fetch(`${API_BASE_URL}/api/user/account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Could not delete account (${res.status})`);
  }
  return data;
}
