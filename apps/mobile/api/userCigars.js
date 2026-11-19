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

/**
 * Same GET, but also returns the snapshot revision from the
 * X-Collection-Revision header. The body shape is unchanged, so
 * fetchUserCigars callers are unaffected.
 *
 * A server without the revision feature omits the header; revision is then
 * null and callers fall back to an unversioned write.
 */
export async function fetchUserCigarsWithRevision(accessToken) {
  const res = await fetch(USER_CIGARS_URL, { headers: jsonHeaders(accessToken) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fetch failed: ${res.status}`);
  }
  const header = res.headers.get('X-Collection-Revision');
  const revision = header == null ? null : Number(header);
  return {
    cigars: await res.json(),
    revision: Number.isFinite(revision) ? revision : null,
  };
}

/** Thrown when the server rejects a snapshot write as stale. */
export class RevisionConflictError extends Error {
  constructor(currentRevision) {
    super('revision_conflict');
    this.name = 'RevisionConflictError';
    this.code = 'REVISION_CONFLICT';
    this.currentRevision = currentRevision;
  }
}

/**
 * Full-replace write guarded by a revision. Omitting baseRevision keeps the
 * legacy unversioned behaviour for servers that predate the check.
 *
 * Throws RevisionConflictError on 409 — the server modified nothing.
 */
export async function saveUserCigars(accessToken, cigars, baseRevision = null) {
  const body = baseRevision == null ? { cigars } : { cigars, baseRevision };
  const res = await fetch(USER_CIGARS_URL, {
    method: 'PUT',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    throw new RevisionConflictError(
      Number.isFinite(Number(err.currentRevision)) ? Number(err.currentRevision) : null
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Save failed: ${res.status}`);
  }
  return res.json();
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
