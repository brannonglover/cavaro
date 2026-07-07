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
      for (const cigar of rows) {
        await db.runAsync(
          `INSERT INTO cigar_catalog (brand, name, line, description, wrapper, binder, filler, length, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(brand, name, length) DO UPDATE SET
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
          cigar.image || ''
        );
      }
    });
  } catch (error) {
    console.log('Catalog sync skipped:', error.message);
  }
}
