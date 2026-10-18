/**
 * Pure helpers for reconciling the local cigar_catalog cache against a fresh
 * API response. Kept free of native imports so scripts/verify-catalog-sync-logic.js
 * can exercise them in plain node.
 *
 * The server has no delete endpoint, but server/scripts/import*Catalog.js delete
 * a brand's rows and re-insert them, so a re-import that drops or renames a
 * vitola genuinely removes rows upstream. Without reconciliation those sizes
 * would linger in every existing install forever.
 */

/** Row identity, matching the table's UNIQUE(brand, name, length, size_name). */
export function catalogRowKey(row) {
  return [row?.brand ?? '', row?.name ?? '', row?.length ?? '', row?.size_name || ''].join('\u0000');
}

/** Distinct, non-empty brands present in an API response. */
export function brandsInResponse(incoming = []) {
  const brands = new Set();
  for (const row of incoming) {
    const brand = row?.brand;
    if (brand) brands.add(brand);
  }
  return [...brands];
}

/** Drops rows sharing an identity, keeping the first. */
export function dedupeIncoming(incoming = []) {
  const seen = new Set();
  const out = [];
  for (const row of incoming) {
    const key = catalogRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** A row is only usable if it has the three fields that form its identity. */
export function isValidCatalogRow(row) {
  return !!(
    typeof row?.brand === 'string' && row.brand.trim() &&
    typeof row?.name === 'string' && row.name.trim() &&
    typeof row?.length === 'string' && row.length.trim()
  );
}

/**
 * Splits a response into usable rows and the brands that had unusable ones.
 *
 * A malformed row is not just skipped: its brand is quarantined from deletion.
 * If Oliva comes back with one row missing its `length`, we no longer know the
 * true set of Oliva rows, and reconciling would delete a valid cached row
 * whose identity simply was not represented in the response.
 */
export function partitionIncoming(incoming = []) {
  const valid = [];
  const untrustedBrands = new Set();
  for (const row of incoming) {
    if (isValidCatalogRow(row)) valid.push(row);
    else if (typeof row?.brand === 'string' && row.brand.trim()) untrustedBrands.add(row.brand);
    else untrustedBrands.add(null); // unattributable damage — see planReconciliation
  }
  return { valid, untrustedBrands };
}

// A response this much smaller than the cache is treated as truncated rather
// than as a genuine mass deletion, and reconciliation is skipped entirely.
export const TRUNCATION_MIN_CACHE = 50;
export const TRUNCATION_RATIO = 0.5;

/**
 * Decides what may safely be deleted.
 *
 * Returns { staleIds, skipped } where `skipped` names the guard that fired, or
 * null when reconciliation ran normally. Deleting nothing is always the safe
 * outcome: stale rows are a cosmetic problem, deleted valid rows are not.
 */
export function planReconciliation({ existing = [], incoming = [], cachedCount = 0 } = {}) {
  const { valid, untrustedBrands } = partitionIncoming(incoming);

  // Checked before the empty case so an all-malformed response is reported as
  // malformed rather than as an empty one — same safe outcome, accurate cause.
  // A row we could not attribute to any brand means the response shape itself
  // is suspect, so nothing is reconciled.
  if (untrustedBrands.has(null)) return { staleIds: [], skipped: 'malformed_response' };

  if (!valid.length) return { staleIds: [], skipped: 'empty_response' };

  if (cachedCount >= TRUNCATION_MIN_CACHE && valid.length < cachedCount * TRUNCATION_RATIO) {
    return { staleIds: [], skipped: 'response_too_small' };
  }

  const safeBrands = new Set(brandsInResponse(valid).filter((b) => !untrustedBrands.has(b)));
  const incomingKeys = new Set(valid.map(catalogRowKey));
  const staleIds = existing
    .filter((row) => safeBrands.has(row?.brand) && !incomingKeys.has(catalogRowKey(row)))
    .map((row) => row.id)
    .filter((id) => id !== undefined && id !== null);

  return { staleIds, skipped: null };
}

/**
 * Ids of cached rows that should be removed.
 *
 * Scoped deliberately: only rows whose brand appears in the response are
 * candidates. A response that omits a brand entirely (a partial or filtered
 * fetch) must never wipe that brand's cached rows, so anything outside the
 * returned brands is always kept.
 */
export function findStaleCatalogIds(existing = [], incoming = []) {
  const incomingKeys = new Set(incoming.map(catalogRowKey));
  const brands = new Set(brandsInResponse(incoming));
  return existing
    .filter((row) => brands.has(row?.brand) && !incomingKeys.has(catalogRowKey(row)))
    .map((row) => row.id)
    .filter((id) => id !== undefined && id !== null);
}

/** Splits ids into chunks that stay under SQLite's bound-variable limit. */
export function chunkIds(ids = [], size = 200) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}
