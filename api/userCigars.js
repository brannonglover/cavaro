import { API_BASE_URL } from './config';

const USER_CIGARS_URL = `${API_BASE_URL}/api/user/cigars`;

export async function fetchUserCigars(accessToken) {
  const res = await fetch(USER_CIGARS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch user cigars: ${res.status}`);
  }
  return res.json();
}

export async function saveUserCigars(accessToken, cigars) {
  const res = await fetch(USER_CIGARS_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cigars }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save user cigars: ${res.status}`);
  }
  return res.json();
}
