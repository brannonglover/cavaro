/**
 * Centralized database module for Humidor app.
 * Uses a single `cigars` table with a `collection` column instead of
 * three separate tables (humidor, likes, dislikes).
 * Uses `cigar_catalog` as the central catalog users select from.
 */
import * as SQLite from 'expo-sqlite';
import catalogData from '../assets/cigars.json';

const DB_NAME = 'cigars.db';
export const db = SQLite.openDatabaseSync(DB_NAME);

const COLLECTIONS = {
  HUMIDOR: 'humidor',
  LIKES: 'likes',
  DISLIKES: 'dislikes',
};

export { COLLECTIONS };

/**
 * Creates tables and migrates data. Seeds cigar_catalog from cigars.json if empty.
 */
export async function initDatabase() {
  await db.withTransactionAsync(async () => {
    // Create cigar catalog table (central database users select from)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cigar_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        wrapper TEXT,
        binder TEXT,
        filler TEXT,
        length TEXT NOT NULL,
        image TEXT,
        UNIQUE(brand, name, length)
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_catalog_brand ON cigar_catalog(brand)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON cigar_catalog(brand, name)
    `);

    // Create user cigars table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cigars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT,
        name TEXT,
        description TEXT,
        wrapper TEXT,
        binder TEXT,
        filler TEXT,
        length TEXT,
        image TEXT,
        collection TEXT NOT NULL DEFAULT 'humidor' CHECK(collection IN ('humidor', 'likes', 'dislikes'))
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cigars_collection ON cigars(collection)
    `);

    // Seed catalog from cigars.json if empty
    const catalogCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM cigar_catalog');
    if (catalogCount && catalogCount.count === 0) {
      for (const cigar of catalogData) {
        const sizes = cigar.size || [{ length: '', image: '' }];
        for (const size of sizes) {
          const length = size.length || '';
          const image = size.image || cigar.image || '';
          try {
            await db.runAsync(
              `INSERT OR IGNORE INTO cigar_catalog (brand, name, description, wrapper, binder, filler, length, image)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              cigar.brand || '',
              cigar.name || '',
              cigar.description || '',
              cigar.wrapper || '',
              cigar.binder || '',
              cigar.filler || '',
              length,
              image
            );
          } catch (e) {
            // Skip duplicates
          }
        }
      }
    }

    // Check if old tables exist (migration from previous schema)
    const humidorTable = await db.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='humidor'"
    );
    const hasOldTables = !!humidorTable;

    if (hasOldTables) {
      // Migrate data from old tables to new unified table
      await db.execAsync(`
        INSERT INTO cigars (brand, name, description, wrapper, binder, filler, length, image, collection)
        SELECT brand, name, description, wrapper, binder, filler, length, image, 'humidor' FROM humidor
      `);
      await db.execAsync(`
        INSERT INTO cigars (brand, name, description, wrapper, binder, filler, length, image, collection)
        SELECT brand, name, description, wrapper, binder, filler, length, image, 'likes' FROM likes
      `);
      await db.execAsync(`
        INSERT INTO cigars (brand, name, description, wrapper, binder, filler, length, image, collection)
        SELECT brand, name, description, wrapper, binder, filler, length, image, 'dislikes' FROM dislikes
      `);

      // Drop old tables
      await db.execAsync('DROP TABLE humidor');
      await db.execAsync('DROP TABLE likes');
      await db.execAsync('DROP TABLE dislikes');
    }
  });
}
