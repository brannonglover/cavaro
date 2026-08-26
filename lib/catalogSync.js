import { fetchCatalog } from '../api/catalog';
import { db, whenDatabaseReady, withSerializedTransaction } from '../db';
import { serializeFlavors } from './tasteVocabulary';

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

/**
 * Refreshes the local cigar_catalog cache from the API (including image URLs).
 * Fails silently when offline so cached data still works.
 */
export async function syncCatalogCache() {
  try {
    await whenDatabaseReady();
    const rows = await fetchCatalog();
    if (!rows?.length) return;

    await withSerializedTransaction(async () => {
      const seen = new Set();
      for (const cigar of rows) {
        const sizeName = cigar.size_name || '';
        const key = `${cigar.brand}::${cigar.name}::${cigar.length}::${sizeName}`;
        if (seen.has(key)) continue;
        seen.add(key);
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
  } catch (error) {
    console.log('Catalog sync skipped:', error.message);
  }
}
