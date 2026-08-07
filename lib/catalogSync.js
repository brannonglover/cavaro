import { fetchCatalog } from '../api/catalog';
import { db } from '../db';

/**
 * Refreshes the local cigar_catalog cache from the API (including image URLs).
 * Fails silently when offline so cached data still works.
 */
export async function syncCatalogCache() {
  try {
    const rows = await fetchCatalog();
    if (!rows?.length) return;

    await db.withTransactionAsync(async () => {
      const seen = new Set();
      for (const cigar of rows) {
        const sizeName = cigar.size_name || '';
        const key = `${cigar.brand}::${cigar.name}::${cigar.length}::${sizeName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await db.runAsync(
          `INSERT INTO cigar_catalog (brand, name, line, description, wrapper, binder, filler, length, image, size_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(brand, name, length, size_name) DO UPDATE SET
             line = COALESCE(NULLIF(excluded.line, ''), line),
             description = COALESCE(NULLIF(excluded.description, ''), description),
             wrapper = COALESCE(NULLIF(excluded.wrapper, ''), wrapper),
             binder = COALESCE(NULLIF(excluded.binder, ''), binder),
             filler = COALESCE(NULLIF(excluded.filler, ''), filler),
             image = COALESCE(NULLIF(excluded.image, ''), image)`,
          cigar.brand || '',
          cigar.name || '',
          cigar.line || '',
          cigar.description || '',
          cigar.wrapper || '',
          cigar.binder || '',
          cigar.filler || '',
          cigar.length || '',
          cigar.image || '',
          sizeName
        );
      }
    });
  } catch (error) {
    console.log('Catalog sync skipped:', error.message);
  }
}
