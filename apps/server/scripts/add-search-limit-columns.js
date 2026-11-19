/**
 * Adds search_count and search_count_reset_at to user_profiles for free-tier search limits.
 * Run: cd server && node scripts/add-search-limit-columns.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function run() {
  await pool.query(`
    ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS search_count INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS search_count_reset_at TIMESTAMPTZ
  `);
  console.log('user_profiles search limit columns ready');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
