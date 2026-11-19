/**
 * Adds apple_original_transaction_id for Apple IAP (run once on existing DBs).
 * cd server && node scripts/add-apple-iap-column.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function run() {
  await pool.query(`
    ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_apple_otid
    ON user_profiles(apple_original_transaction_id)
    WHERE apple_original_transaction_id IS NOT NULL
  `);
  console.log('user_profiles.apple_original_transaction_id ready');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
