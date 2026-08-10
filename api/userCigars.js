import { API_BASE_URL } from './config';

const USER_CIGARS_URL = `${API_BASE_URL}/api/user/cigars`;
const USER_HUMIDORS_URL = `${API_BASE_URL}/api/user/humidors`;
const USER_CELLARED_URL = `${API_BASE_URL}/api/user/cellared`;
const USER_JOURNAL_URL = `${API_BASE_URL}/api/user/journal`;

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function jsonHeaders(accessToken) {
  return { ...authHeaders(accessToken), 'Content-Type': 'application/json' };
}

async function fetchJson(url, accessToken) {
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fetch failed: ${res.status}`);
  }
  return res.json();
}

async function putJson(url, accessToken, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Save failed: ${res.status}`);
  }
  return res.json();
}

export function fetchUserCigars(accessToken) {
  return fetchJson(USER_CIGARS_URL, accessToken);
}

export function saveUserCigars(accessToken, cigars) {
  return putJson(USER_CIGARS_URL, accessToken, { cigars });
}

export function fetchUserHumidors(accessToken) {
  return fetchJson(USER_HUMIDORS_URL, accessToken);
}

export function saveUserHumidors(accessToken, humidors) {
  return putJson(USER_HUMIDORS_URL, accessToken, { humidors });
}

export function fetchUserCellared(accessToken) {
  return fetchJson(USER_CELLARED_URL, accessToken);
}

export function saveUserCellared(accessToken, items) {
  return putJson(USER_CELLARED_URL, accessToken, { items });
}

export function fetchUserJournal(accessToken) {
  return fetchJson(USER_JOURNAL_URL, accessToken);
}

export function saveUserJournal(accessToken, entries) {
  return putJson(USER_JOURNAL_URL, accessToken, { entries });
}
