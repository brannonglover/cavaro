import { API_BASE_URL } from './config';

/**
 * Uploads an image and returns its public URL.
 *
 * The endpoint now requires a Supabase access token (it used to accept anything
 * from anyone). `folder` must be one of the destinations the server whitelists:
 * 'cigars' or 'avatars'.
 */
export async function uploadImage(localUri, { folder = 'cigars', accessToken } = {}) {
  if (!localUri) return null;

  const formData = new FormData();
  // Text fields before the file: multer exposes req.body as it parses, and the
  // route reads `folder` to pick the destination.
  formData.append('folder', folder);
  const filename = localUri.split('/').pop() || `${folder}_${Date.now()}.jpg`;
  formData.append('image', {
    uri: localUri,
    type: 'image/jpeg',
    name: filename,
  });

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    // Don't set Content-Type - fetch sets it with boundary for FormData
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('Sign in again, then try uploading that image.');
    }
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.url;
}

/** Cigar photo. Kept as a named helper so existing call sites read the same. */
export async function uploadCigarImage(localUri, accessToken) {
  return uploadImage(localUri, { folder: 'cigars', accessToken });
}

/** Profile photo. Always requires a signed-in user. */
export async function uploadAvatarImage(localUri, accessToken) {
  return uploadImage(localUri, { folder: 'avatars', accessToken });
}
