/**
 * Creates user_cigars table for server-side favorites/dislikes sync.
 * Run: cd server && node scripts/init-user-cigars.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_cigars (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      length TEXT NOT NULL,
      line TEXT,
      description TEXT,
      wrapper TEXT,
      binder TEXT,
      filler TEXT,
      image TEXT,
      collection TEXT NOT NULL DEFAULT 'cavaro'
        CHECK (collection IN ('cavaro', 'likes', 'dislikes')),
      is_favorite BOOLEAN NOT NULL DEFAULT false,
      quantity INTEGER NOT NULL DEFAULT 1,
      smoked_date TEXT,
      smoke_notes TEXT,
      favorite_notes TEXT,
      flavor_profile TEXT,
      strength_profile TEXT,
      construction_quality TEXT,
      flavor_changes TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, brand, name, length)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_cigars_user ON user_cigars(user_id)
  `);
  console.log('user_cigars table ready');
  process.exit(0);
}

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
