/**
 * Centralized database module for Humidor app.
 * Uses a single `cigars` table with a `collection` column instead of
 * three separate tables (humidor, likes, dislikes).
 * cigar_catalog: local cache/fallback when API is unavailable (see api/catalog.js).
 * Primary catalog source is PostgreSQL via API.
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cigars.db';
export const db = SQLite.openDatabaseSync(DB_NAME);

const COLLECTIONS = {
  HUMIDOR: 'humidor',
  LIKES: 'likes',
  DISLIKES: 'dislikes',
};

export { COLLECTIONS };

/**
 * Creates tables and migrates data. Catalog is fetched from API; local cigar_catalog is offline cache.
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
        quantity INTEGER NOT NULL DEFAULT 1,
        collection TEXT NOT NULL DEFAULT 'humidor' CHECK(collection IN ('humidor', 'likes', 'dislikes'))
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cigars_collection ON cigars(collection)
    `);

    // Catalog comes from API (PostgreSQL). Local table is cache/offline fallback.
    // Seed server: cd server && npm run init-catalog

    // Add quantity column if missing (migration for existing DBs)
    const tableInfo = await db.getAllAsync('PRAGMA table_info(cigars)');
    const hasQuantity = tableInfo.some((col) => col.name === 'quantity');
    if (!hasQuantity) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1');
    }

    // Add is_favorite column if missing (migration for existing DBs)
    const tableInfo2 = await db.getAllAsync('PRAGMA table_info(cigars)');
    const hasIsFavorite = tableInfo2.some((col) => col.name === 'is_favorite');
    if (!hasIsFavorite) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
      await db.execAsync("UPDATE cigars SET is_favorite = 1 WHERE collection = 'likes'");
    }

    // Add favorite notes columns if missing
    const tableInfo3 = await db.getAllAsync('PRAGMA table_info(cigars)');
    const colNames = new Set(tableInfo3.map((c) => c.name));
    const noteCols = ['favorite_notes', 'flavor_profile', 'construction_quality', 'smoked_date', 'flavor_changes'];
    for (const col of noteCols) {
      if (!colNames.has(col)) {
        await db.execAsync(`ALTER TABLE cigars ADD COLUMN ${col} TEXT`);
      }
    }

    // Add strength_profile column if missing (JSON: { thirds: [{ strength, flavors }] })
    const tableInfo4 = await db.getAllAsync('PRAGMA table_info(cigars)');
    const hasStrengthProfile = tableInfo4.some((c) => c.name === 'strength_profile');
    if (!hasStrengthProfile) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN strength_profile TEXT');
    }

    // Add date_added column if missing (ISO date YYYY-MM-DD when cigar entered humidor)
    const tableInfo5 = await db.getAllAsync('PRAGMA table_info(cigars)');
    const hasDateAdded = tableInfo5.some((c) => c.name === 'date_added');
    if (!hasDateAdded) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN date_added TEXT');
    }

    // Create smoke_history table (tracks when each cigar was smoked, for quantity > 1)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS smoke_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cigar_id INTEGER NOT NULL,
        smoked_at TEXT NOT NULL,
        FOREIGN KEY (cigar_id) REFERENCES cigars(id)
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_smoke_history_cigar ON smoke_history(cigar_id)
    `);

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
