/**
 * Centralized database module for Cavaro app.
 * Uses a single `cigars` table with a `collection` column instead of
 * three separate tables (cavaro, likes, dislikes).
 * cigar_catalog: local cache/fallback when API is unavailable (see api/catalog.js).
 * Primary catalog source is PostgreSQL via API.
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cigars.db';
export const db = SQLite.openDatabaseSync(DB_NAME);

const COLLECTIONS = {
  CAVARO: 'cavaro',
  LIKES: 'likes',
  DISLIKES: 'dislikes',
  ARCHIVE: 'archive',
};

/** Smoked cigars still in Cavaro with no favorite/dislike decision yet. */
export const ARCHIVE_WHERE =
  "collection = 'cavaro' AND quantity = 0 AND is_favorite = 0 AND EXISTS (SELECT 1 FROM smoke_history sh WHERE sh.cigar_id = cigars.id)";

export async function getArchiveCount() {
  const row = await db.getFirstAsync(`SELECT COUNT(*) as n FROM cigars WHERE ${ARCHIVE_WHERE}`);
  return row?.n ?? 0;
}

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
        line TEXT,
        description TEXT,
        wrapper TEXT,
        binder TEXT,
        filler TEXT,
        length TEXT NOT NULL,
        image TEXT,
        size_name TEXT DEFAULT '',
        UNIQUE(brand, name, length, size_name)
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_catalog_brand ON cigar_catalog(brand)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON cigar_catalog(brand, name)
    `);
    const catalogInfo = await db.getAllAsync('PRAGMA table_info(cigar_catalog)');
    if (!catalogInfo.some((c) => c.name === 'line')) {
      await db.execAsync('ALTER TABLE cigar_catalog ADD COLUMN line TEXT');
    }
    const catalogSql = (
      await db.getFirstAsync("SELECT sql FROM sqlite_master WHERE type='table' AND name='cigar_catalog'")
    )?.sql || '';
    const needsSizeNameRebuild =
      !catalogInfo.some((c) => c.name === 'size_name') ||
      !catalogSql.includes('size_name') ||
      (catalogSql.includes('UNIQUE(brand, name, length)') &&
        !catalogSql.includes('UNIQUE(brand, name, length, size_name)'));
    if (needsSizeNameRebuild) {
      // Rebuild so UNIQUE includes size_name (same length, different vitolas).
      if (!catalogInfo.some((c) => c.name === 'size_name')) {
        await db.execAsync('ALTER TABLE cigar_catalog ADD COLUMN size_name TEXT');
      }
      await db.execAsync(`
        CREATE TABLE cigar_catalog_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand TEXT NOT NULL,
          name TEXT NOT NULL,
          line TEXT,
          description TEXT,
          wrapper TEXT,
          binder TEXT,
          filler TEXT,
          length TEXT NOT NULL,
          image TEXT,
          size_name TEXT DEFAULT '',
          UNIQUE(brand, name, length, size_name)
        )
      `);
      await db.execAsync(`
        INSERT INTO cigar_catalog_new (brand, name, line, description, wrapper, binder, filler, length, image, size_name)
        SELECT brand, name, line, description, wrapper, binder, filler, length, image, COALESCE(size_name, '')
        FROM cigar_catalog
      `);
      await db.execAsync('DROP TABLE cigar_catalog');
      await db.execAsync('ALTER TABLE cigar_catalog_new RENAME TO cigar_catalog');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_catalog_brand ON cigar_catalog(brand)');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON cigar_catalog(brand, name)');
    }

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
        collection TEXT NOT NULL DEFAULT 'cavaro' CHECK(collection IN ('cavaro', 'likes', 'dislikes'))
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cigars_collection ON cigars(collection)
    `);

    // Catalog comes from API (PostgreSQL). Local table is cache/offline fallback.
    // Seed server: cd server && npm run init-catalog

    // Migrations: add columns if missing (single PRAGMA call for all checks)
    const cigarsCols = await db.getAllAsync('PRAGMA table_info(cigars)');
    const cigarsColNames = new Set(cigarsCols.map((c) => c.name));

    if (!cigarsColNames.has('quantity')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1');
    }
    if (!cigarsColNames.has('is_favorite')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
      await db.execAsync("UPDATE cigars SET is_favorite = 1 WHERE collection = 'likes'");
    }
    for (const col of ['favorite_notes', 'flavor_profile', 'construction_quality', 'smoked_date', 'flavor_changes']) {
      if (!cigarsColNames.has(col)) {
        await db.execAsync(`ALTER TABLE cigars ADD COLUMN ${col} TEXT`);
      }
    }
    if (!cigarsColNames.has('strength_profile')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN strength_profile TEXT');
    }
    if (!cigarsColNames.has('date_added')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN date_added TEXT');
    }
    if (!cigarsColNames.has('line')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN line TEXT');
    }
    if (!cigarsColNames.has('smoke_notes')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN smoke_notes TEXT');
    }

    // Migration: humidor -> cavaro collection (recreate table to update CHECK constraint)
    const cigarsSchema = await db.getFirstAsync("SELECT sql FROM sqlite_master WHERE type='table' AND name='cigars'");
    if (cigarsSchema?.sql?.includes("'humidor'")) {
      await db.execAsync(`
        CREATE TABLE cigars_new (
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
          collection TEXT NOT NULL DEFAULT 'cavaro' CHECK(collection IN ('cavaro', 'likes', 'dislikes')),
          is_favorite INTEGER NOT NULL DEFAULT 0,
          favorite_notes TEXT,
          flavor_profile TEXT,
          construction_quality TEXT,
          smoked_date TEXT,
          flavor_changes TEXT,
          strength_profile TEXT,
          date_added TEXT,
          line TEXT
        )
      `);
      await db.execAsync(`
        INSERT INTO cigars_new SELECT id, brand, name, description, wrapper, binder, filler, length, image, quantity,
          CASE WHEN collection='humidor' THEN 'cavaro' ELSE collection END,
          COALESCE(is_favorite, 0), favorite_notes, flavor_profile, construction_quality, smoked_date, flavor_changes, strength_profile, date_added, line
        FROM cigars
      `);
      await db.execAsync('DROP TABLE cigars');
      await db.execAsync('ALTER TABLE cigars_new RENAME TO cigars');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_cigars_collection ON cigars(collection)');
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

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS humidors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        humidity REAL,
        temperature REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cellared_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cigar_id INTEGER NOT NULL,
        humidor_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1,
        started_at TEXT NOT NULL,
        target_months INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (cigar_id) REFERENCES cigars(id),
        FOREIGN KEY (humidor_id) REFERENCES humidors(id)
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cellared_cigar ON cellared_items(cigar_id)
    `);

    const humidorIdCol = await db.getAllAsync('PRAGMA table_info(cigars)');
    if (!humidorIdCol.some((c) => c.name === 'humidor_id')) {
      await db.execAsync('ALTER TABLE cigars ADD COLUMN humidor_id INTEGER NOT NULL DEFAULT 1');
    }

    const humidorCount = await db.getFirstAsync('SELECT COUNT(*) as n FROM humidors');
    if ((humidorCount?.n ?? 0) === 0) {
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO humidors (name, created_at, updated_at) VALUES (?, ?, ?)',
        'Main Humidor',
        now,
        now
      );
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS smoke_journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        cigar_id INTEGER NOT NULL,
        smoked_date TEXT NOT NULL,
        rating INTEGER,
        would_buy_again INTEGER,
        notes TEXT,
        liked_flavors TEXT NOT NULL DEFAULT '[]',
        disliked_flavors TEXT NOT NULL DEFAULT '[]',
        strength_feedback TEXT,
        draw TEXT,
        burn TEXT,
        finish TEXT,
        smoked_from_humidor_item_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (cigar_id) REFERENCES cigars(id)
      )
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_journal_cigar ON smoke_journal_entries(cigar_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_journal_smoked_date ON smoke_journal_entries(smoked_date)
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
        SELECT brand, name, description, wrapper, binder, filler, length, image, 'cavaro' FROM humidor
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

  const { migrateSmokeHistoryToJournal } = await import('./journal');
  await migrateSmokeHistoryToJournal();
}

/**
 * Search user cigars by taste profile keywords.
 * Searches: flavor_profile, favorite_notes, flavor_changes, strength_profile (flavors JSON),
 * description, wrapper, binder, filler.
 * Keywords are OR'd together (any match).
 */
export async function searchCigarsByTaste(keywords) {
  if (!keywords?.length) return [];
  const terms = keywords
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => k.length > 0);
  if (terms.length === 0) return [];

  const conditions = [];
  const params = [];
  for (const term of terms) {
    const like = `%${term}%`;
    conditions.push(
      `(COALESCE(flavor_profile,'') LIKE ? OR COALESCE(favorite_notes,'') LIKE ? OR ` +
        `COALESCE(flavor_changes,'') LIKE ? OR COALESCE(strength_profile,'') LIKE ? OR ` +
        `COALESCE(description,'') LIKE ? OR COALESCE(wrapper,'') LIKE ? OR ` +
        `COALESCE(binder,'') LIKE ? OR COALESCE(filler,'') LIKE ?)`
    );
    params.push(like, like, like, like, like, like, like, like);
  }
  const whereClause = conditions.join(' OR ');
  const rows = await db.getAllAsync(
    `SELECT * FROM cigars WHERE ${whereClause} ORDER BY collection = 'likes' DESC, brand, name`,
    params.flat()
  );
  return rows ?? [];
}

export async function getTopReviewedCigars(limit = 5) {
  const rows = await db.getAllAsync(`
    SELECT c.*,
      (CASE WHEN c.is_favorite = 1 THEN 1 ELSE 0 END) +
      (CASE WHEN c.favorite_notes IS NOT NULL AND c.favorite_notes != '' THEN 1 ELSE 0 END) +
      (CASE WHEN c.flavor_profile IS NOT NULL AND c.flavor_profile != '' THEN 1 ELSE 0 END) +
      (CASE WHEN c.strength_profile IS NOT NULL AND c.strength_profile != '' THEN 1 ELSE 0 END) +
      (CASE WHEN c.construction_quality IS NOT NULL AND c.construction_quality != '' THEN 1 ELSE 0 END) +
      (CASE WHEN c.flavor_changes IS NOT NULL AND c.flavor_changes != '' THEN 1 ELSE 0 END) +
      COALESCE((SELECT COUNT(*) FROM smoke_history sh WHERE sh.cigar_id = c.id), 0) AS review_score
    FROM cigars c
    WHERE (c.collection = 'likes' OR (c.collection = 'cavaro' AND c.is_favorite = 1))
      AND (
        (c.favorite_notes IS NOT NULL AND c.favorite_notes != '')
        OR (c.flavor_profile IS NOT NULL AND c.flavor_profile != '')
        OR (c.strength_profile IS NOT NULL AND c.strength_profile != '')
      )
    ORDER BY review_score DESC, c.brand, c.name
    LIMIT ?
  `, [limit]);
  return rows ?? [];
}

export async function getHumidors() {
  const rows = await db.getAllAsync(`
    SELECT h.*,
      COALESCE((
        SELECT SUM(c.quantity)
        FROM cigars c
        WHERE c.humidor_id = h.id
          AND c.collection = 'cavaro'
          AND c.quantity > 0
      ), 0) AS cigar_count
    FROM humidors h
    ORDER BY h.id
  `);
  return rows ?? [];
}

export async function createHumidor(name) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error('Humidor name is required');
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO humidors (name, created_at, updated_at) VALUES (?, ?, ?)',
    trimmed,
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function moveCigarToHumidor(cigarId, targetHumidorId) {
  await db.runAsync(
    'UPDATE cigars SET humidor_id = ? WHERE id = ?',
    targetHumidorId,
    cigarId
  );
}

export async function startCellaring({
  cigarId,
  humidorId,
  quantity = 1,
  targetMonths,
  notes,
}) {
  const today = new Date().toISOString().slice(0, 10);
  await db.withTransactionAsync(async () => {
    const cigar = await db.getFirstAsync(
      'SELECT quantity, humidor_id FROM cigars WHERE id = ?',
      cigarId
    );
    const available = Math.max(0, parseInt(cigar?.quantity, 10) || 0);
    const cellarQty = Math.min(Math.max(1, quantity), available);
    if (cellarQty < 1) {
      throw new Error('No inventory available to cellar');
    }

    await db.runAsync(
      `INSERT INTO cellared_items (
        cigar_id, humidor_id, quantity, started_at, target_months, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      cigarId,
      humidorId ?? cigar?.humidor_id ?? 1,
      cellarQty,
      today,
      targetMonths ?? null,
      notes?.trim() || null,
      today,
      today
    );
    await db.runAsync(
      'UPDATE cigars SET quantity = ? WHERE id = ?',
      available - cellarQty,
      cigarId
    );
  });
}

/**
 * Removes local collection and smoke history (e.g. after account deletion).
 */
export async function wipeLocalUserData() {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM smoke_journal_entries');
    await db.execAsync('DELETE FROM smoke_history');
    await db.execAsync('DELETE FROM cellared_items');
    await db.execAsync('DELETE FROM cigars');
    await db.execAsync('DELETE FROM humidors');
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO humidors (name, created_at, updated_at) VALUES (?, ?, ?)',
      'Main Humidor',
      now,
      now
    );
  });
}

export {
  createJournalEntry,
  getJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  migrateSmokeHistoryToJournal,
  markCigarSmokedWithJournal,
} from './journal';
