import { API_BASE_URL } from './config';

export async function getDrinkPairing(cigar) {
  const res = await fetch(`${API_BASE_URL}/api/pairing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cigar: (cigar || '').trim() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to get pairing suggestions');
  }
  return data.pairing;
}
