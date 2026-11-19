/**
 * Cigar identity rules, kept free of native imports so they can be exercised
 * in plain node (see scripts/verify-migration-logic.js).
 *
 * A cigar's identity across local SQLite and the server is the triple
 * (brand, name, length), trimmed. This is the same key mergeServerCigarsIntoLocal
 * matches on, so dedupe during a guest migration and the post-push confirmation
 * agree by construction.
 *
 * Consequence worth knowing: matching is exact on the trimmed strings. "6x52"
 * and "6 x 52" are different cigars, as are "Padron" and "Padrón". Near-miss
 * spellings merge as two rows rather than one.
 */

export function cigarIdentityKey(cigar) {
  const part = (v) => String(v ?? '').trim();
  return `${part(cigar?.brand)}|${part(cigar?.name)}|${part(cigar?.length)}`;
}

/** A cigar is only syncable/comparable if all three identity fields are set. */
export function hasCigarIdentity(cigar) {
  const part = (v) => String(v ?? '').trim();
  return !!part(cigar?.brand) && !!part(cigar?.name) && !!part(cigar?.length);
}

/**
 * Local cigars with no counterpart on the server, by identity triple.
 *
 * Used to confirm a guest migration actually persisted before local rows are
 * allowed to be deleted. Rows lacking a full identity are ignored, matching
 * what the sync layer is willing to push.
 */
export function findCigarsMissingFromCloud(local, remote) {
  const remoteKeys = new Set((remote ?? []).filter(hasCigarIdentity).map(cigarIdentityKey));
  return (local ?? [])
    .filter(hasCigarIdentity)
    .filter((c) => !remoteKeys.has(cigarIdentityKey(c)));
}
