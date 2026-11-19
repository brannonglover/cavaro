import { API_BASE_URL } from './config';

/**
 * Premium AI tasting notes for a cigar, including how it may fit the user's palate.
 * @param {{
 *   cigar: string,
 *   catalog?: object,
 *   palate?: object,
 * }} payload
 * @param {string} [accessToken]
 */
export async function analyzeCigarTaste(payload, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/taste/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cigar: (payload?.cigar || '').trim(),
      catalog: payload?.catalog ?? null,
      palate: payload?.palate ?? null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 403) {
    const err = new Error(data.error || 'Premium required for tasting notes');
    err.code = 'PREMIUM_REQUIRED';
    throw err;
  }
  if (res.status === 401) {
    const err = new Error(data.error || 'Sign in required');
    err.code = 'SIGN_IN_REQUIRED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to analyze cigar taste');
  }
  return data;
}
