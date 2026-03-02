import { API_BASE_URL } from './config';

const CATALOG_URL = `${API_BASE_URL}/api/catalog`;

export async function fetchCatalog() {
  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch catalog: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.message?.includes('Network request failed') || err.name === 'TypeError') {
      throw new Error(
        'Cannot reach server. Make sure the server is running and EXPO_PUBLIC_API_URL matches your machine\'s IP.'
      );
    }
    throw err;
  }
}

export async function addCigarToCatalog(cigar) {
  try {
    const res = await fetch(CATALOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: cigar.brand,
        name: cigar.name,
        description: cigar.description,
        wrapper: cigar.wrapper,
        binder: cigar.binder,
        filler: cigar.filler,
        length: cigar.length,
        image: cigar.image || '',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to add cigar: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.message?.includes('Network request failed') || err.name === 'TypeError') {
      throw new Error(
        'Cannot reach server. Make sure the server is running (npm start in server/) and EXPO_PUBLIC_API_URL in .env matches your machine\'s IP (e.g. http://192.168.1.x:5000).'
      );
    }
    throw err;
  }
}
