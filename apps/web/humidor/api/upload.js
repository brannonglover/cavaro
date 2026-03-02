import { API_BASE_URL } from './config';

export async function uploadCigarImage(localUri) {
  if (!localUri) return null;

  const formData = new FormData();
  const filename = localUri.split('/').pop() || `cigar_${Date.now()}.jpg`;
  formData.append('image', {
    uri: localUri,
    type: 'image/jpeg',
    name: filename,
  });

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type - fetch sets it with boundary for FormData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.url;
}
