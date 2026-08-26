import { API_BASE_URL } from './config';

const REVIEWS_URL = `${API_BASE_URL}/api/reviews`;

/**
 * Search catalog + community reviews by taste keywords or cigar name.
 * @param {string[]} keywords - Search terms
 * @param {string} [accessToken] - Supabase access token (required for auth)
 * @param {'taste'|'cigar'} [type='taste']
 * @returns {Promise<object[]>} Cigar results
 * @throws {Error} When search limit exceeded (429) or other errors
 */
export async function searchReviewsByTaste(keywords, accessToken, type = 'taste') {
  if (!keywords?.length) return [];
  const q = keywords.map((k) => String(k).trim()).filter(Boolean).join(',');
  if (!q) return [];
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const searchType = type === 'cigar' ? 'cigar' : 'taste';
  try {
    const res = await fetch(
      `${REVIEWS_URL}/search?q=${encodeURIComponent(q)}&type=${searchType}`,
      { headers }
    );
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error || 'Daily search limit reached');
      err.code = 'SEARCH_LIMIT_EXCEEDED';
      err.searchesRemaining = data.searchesRemaining ?? 0;
      throw err;
    }
    if (res.status === 401) {
      const err = new Error('Sign in required to search');
      err.code = 'SIGN_IN_REQUIRED';
      throw err;
    }
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  } catch (err) {
    if (err.code === 'SEARCH_LIMIT_EXCEEDED' || err.code === 'SIGN_IN_REQUIRED') throw err;
    console.warn('Reviews search failed:', err.message);
    return [];
  }
}

/**
 * Get top-rated cigars from community reviews. Premium only.
 * @param {number} [limit=5]
 * @param {string} [accessToken] - Supabase access token (required for auth)
 * @returns {Promise<object[]>} Cigar results, or [] if free tier / not ok
 */
export async function getTopReviewedCigars(limit = 5, accessToken) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const res = await fetch(`${REVIEWS_URL}/top?limit=${limit}`, { headers });
    if (res.status === 401 || res.status === 403) return [];
    if (!res.ok) throw new Error(`Top failed: ${res.status}`);
    const rows = await res.json();
    return rows ?? [];
  } catch (err) {
    console.warn('Reviews top failed:', err.message);
    return [];
  }
}

export async function submitReview(review) {
  const { catalog_id, brand, name, length, user_id, rating, flavor_profile, favorite_notes, strength_profile, construction_quality, flavor_changes } = review;
  const res = await fetch(REVIEWS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog_id: catalog_id ?? null,
      brand: brand ?? null,
      name: name ?? null,
      length: length ?? null,
      user_id: user_id || null,
      rating: rating != null ? parseInt(rating, 10) : null,
      flavor_profile: flavor_profile || null,
      favorite_notes: favorite_notes || null,
      strength_profile: typeof strength_profile === 'string' ? strength_profile : JSON.stringify(strength_profile || {}),
      construction_quality: construction_quality || null,
      flavor_changes: flavor_changes || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to submit review: ${res.status}`);
  }
  return res.json();
}
