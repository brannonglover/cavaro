/**
 * Creates user_humidors, user_cellared_items, and user_journal_entries tables
 * for full cross-device user data sync.
 * Run: cd server && node scripts/init-user-sync-tables.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_humidors (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      humidity REAL,
      temperature REAL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, name)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_humidors_user ON user_humidors(user_id)
  `);
  console.log('user_humidors table ready');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_cellared_items (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      cigar_brand TEXT NOT NULL,
      cigar_name TEXT NOT NULL,
      cigar_length TEXT NOT NULL,
      humidor_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      started_at TEXT NOT NULL,
      target_months INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_cellared_user ON user_cellared_items(user_id)
  `);
  console.log('user_cellared_items table ready');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_journal_entries (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      cigar_brand TEXT NOT NULL,
      cigar_name TEXT NOT NULL,
      cigar_length TEXT NOT NULL,
      smoked_date TEXT NOT NULL,
      rating INTEGER,
      would_buy_again BOOLEAN,
      notes TEXT,
      liked_flavors TEXT NOT NULL DEFAULT '[]',
      disliked_flavors TEXT NOT NULL DEFAULT '[]',
      strength_feedback TEXT,
      draw TEXT,
      burn TEXT,
      finish TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, cigar_brand, cigar_name, cigar_length, smoked_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_journal_user ON user_journal_entries(user_id)
  `);
  console.log('user_journal_entries table ready');

  // Add date_added and humidor_name columns to user_cigars if missing
  const { rows: cigarCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_cigars'
  `);
  const colNames = new Set(cigarCols.map((c) => c.column_name));

  if (!colNames.has('date_added')) {
    await pool.query('ALTER TABLE user_cigars ADD COLUMN date_added TEXT');
    console.log('Added date_added to user_cigars');
  }
  if (!colNames.has('humidor_name')) {
    await pool.query('ALTER TABLE user_cigars ADD COLUMN humidor_name TEXT');
    console.log('Added humidor_name to user_cigars');
  }

  process.exit(0);
}

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
