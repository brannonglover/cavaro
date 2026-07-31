import { API_BASE_URL } from './config';

export async function getDrinkPairing(cigar, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${API_BASE_URL}/api/pairing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cigar: (cigar || '').trim() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to get pairing suggestions');
  }
  return Array.isArray(data.pairings) ? data.pairings : [];
}
