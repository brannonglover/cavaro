import { fetchCatalog } from '../api/catalog';
import { db, whenDatabaseReady, withSerializedTransaction } from '../db';
import { serializeFlavors } from './tasteVocabulary';
import {
  brandsInResponse,
  chunkIds,
  dedupeIncoming,
  planReconciliation,
} from './catalogReconcile';

/**
 * Local cigar_catalog cache.
 *
 * Every screen that needs the catalog goes through `syncCatalogCache()`, which
 * is deduplicated and rate limited, so Home, Collection, Taste Search and Add
 * Cigar can all ask for it on focus without triggering several ~1MB downloads
 * or racing each other's writes.
 *
 * No caller should await this before rendering: read the cache with
 * `getCachedCatalogRows()` first and let the refresh land in the background.
 */

export const CATALOG_TTL_MS = 5 * 60 * 1000;

// Upserts per transaction. Small enough that the shared connection is never
// inside a transaction for long, large enough to avoid per-row fsync cost.
const UPSERT_BATCH = 100;

function chunkRows(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function catalogCacheValues(cigar) {
  const sizeName = cigar.size_name || '';
  return [
    cigar.brand || '',
    cigar.name || '',
    cigar.line || '',
    cigar.description || '',
    cigar.wrapper || '',
    cigar.binder || '',
    cigar.filler || '',
    cigar.length || '',
    cigar.image || '',
    sizeName,
    serializeFlavors(cigar.flavors),
    cigar.strength || null,
    cigar.taste_source || null,
  ];
}

/** Reads the whole local catalog. Safe to call while a refresh is in flight. */
export async function getCachedCatalogRows() {
  try {
    return (await db.getAllAsync('SELECT * FROM cigar_catalog ORDER BY brand, name, length')) || [];
  } catch (error) {
    console.warn('Catalog cache read failed:', error.message);
    return [];
  }
}

export async function getCachedCatalogCount() {
  try {
    const row = await db.getFirstAsync('SELECT COUNT(*) as n FROM cigar_catalog');
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Writes catalog rows into the local cache, then removes rows the server no
 * longer has for the brands it just told us about.
 *
 * Ordering is the safety property. Upserts run first and deletions last, so at
 * every point in the transaction the table holds *every* current row — a reader
 * that interleaves can only ever see extra, stale rows, never a catalog that is
 * missing entries. That matters because readers (Add Cigar, Taste Search, My
 * Taste, cigar images) query this table without any locking, and expo-sqlite
 * shares one connection, so they can observe uncommitted state.
 *
 * Reconciliation is scoped to brands present in the response. The server has no
 * delete endpoint, but `server/scripts/import*Catalog.js` delete a brand's rows
 * and re-insert them, so a re-import that drops or renames a vitola really does
 * remove rows upstream. Without this, those sizes would linger on existing
 * installs forever.
 */
export async function upsertCatalogRows(rows) {
  if (!rows?.length) return { inserted: 0, removed: 0, skipped: 'empty_response' };

  const deduped = dedupeIncoming(rows);
  const cachedCount = await getCachedCatalogCount();

  // Written in small transactions rather than one big one. expo-sqlite shares a
  // single connection (db/index.js openDatabaseSync) and 45 db.runAsync calls
  // around the app bypass enqueueDbWrite, so any write issued while a
  // transaction is open joins it — and would be rolled back with it. Batching
  // ~1200 upserts into one transaction kept that window open for seconds; these
  // chunks keep it to milliseconds. Correctness for readers does not depend on
  // the transaction boundary, only on the upsert-before-delete ordering below.
  for (const batch of chunkRows(deduped, UPSERT_BATCH)) {
    await withSerializedTransaction(async () => {
      for (const cigar of batch) {
        await db.runAsync(
          `INSERT INTO cigar_catalog (
             brand, name, line, description, wrapper, binder, filler, length, image, size_name,
             flavors, strength, taste_source
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(brand, name, length, size_name) DO UPDATE SET
             line = COALESCE(NULLIF(excluded.line, ''), line),
             description = COALESCE(NULLIF(excluded.description, ''), description),
             wrapper = COALESCE(NULLIF(excluded.wrapper, ''), wrapper),
             binder = COALESCE(NULLIF(excluded.binder, ''), binder),
             filler = COALESCE(NULLIF(excluded.filler, ''), filler),
             image = COALESCE(NULLIF(excluded.image, ''), image),
             flavors = COALESCE(excluded.flavors, flavors),
             strength = COALESCE(NULLIF(excluded.strength, ''), strength),
             taste_source = COALESCE(NULLIF(excluded.taste_source, ''), taste_source)`,
          ...catalogCacheValues(cigar)
        );
      }
    });
  }

  // Deletions strictly after every upsert has committed. Until this point the
  // table is a superset of the live catalog, so a concurrent reader can only
  // see extra stale rows, never a missing one.
  const brandList = brandsInResponse(deduped);
  if (!brandList.length) return { inserted: deduped.length, removed: 0, skipped: 'no_brands' };

  const placeholders = brandList.map(() => '?').join(',');
  const existing =
    (await db.getAllAsync(
      `SELECT id, brand, name, length, size_name FROM cigar_catalog WHERE brand IN (${placeholders})`,
      ...brandList
    )) || [];

  const { staleIds, skipped } = planReconciliation({ existing, incoming: deduped, cachedCount });
  if (skipped) {
    console.log(`Catalog reconciliation skipped (${skipped}); keeping all cached rows`);
    return { inserted: deduped.length, removed: 0, skipped };
  }

  for (const chunk of chunkIds(staleIds)) {
    await withSerializedTransaction(async () => {
      await db.runAsync(
        `DELETE FROM cigar_catalog WHERE id IN (${chunk.map(() => '?').join(',')})`,
        ...chunk
      );
    });
  }

  return { inserted: deduped.length, removed: staleIds.length, skipped: null };
}

// One shared refresh. Concurrent callers get the same promise instead of each
// starting their own download.
let inFlight = null;
let lastSyncAt = 0;

/** For tests and for forcing a cold path. */
export function resetCatalogSyncState() {
  inFlight = null;
  lastSyncAt = 0;
}

/**
 * Refreshes the local cache from the API.
 *
 * Never rejects. Resolves to one of:
 *   { status: 'synced',  count, removed }  - the cache was updated
 *   { status: 'skipped' }                  - refreshed recently, nothing done
 *   { status: 'failed',  error }           - offline or the server errored
 *
 * `force: true` ignores the TTL but still joins a refresh already in flight.
 */
export function syncCatalogCache({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastSyncAt < CATALOG_TTL_MS) {
    return Promise.resolve({ status: 'skipped' });
  }

  const run = async () => {
    try {
      await whenDatabaseReady();
      const rows = await fetchCatalog();
      if (!rows?.length) return { status: 'skipped' };
      const { inserted, removed, skipped } = await upsertCatalogRows(rows);
      lastSyncAt = Date.now();
      return { status: 'synced', count: inserted, removed, reconcileSkipped: skipped };
    } catch (error) {
      console.log('Catalog sync skipped:', error.message);
      return { status: 'failed', error };
    }
  };

  const promise = run();
  inFlight = promise;
  promise.then(() => {
    if (inFlight === promise) inFlight = null;
  });
  return promise;
}
