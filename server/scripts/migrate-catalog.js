/**
 * Ensures cigar_catalog schema is up to date (table, line column, indexes, RLS).
 * Run: npm run migrate-catalog (from server/)
 * Idempotent — safe to run on staging and production.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');
const { ensureCatalogSchema } = require('../lib/catalogSchema');

async function migrateCatalog() {
  try {
    await ensureCatalogSchema(pool);
    console.log('cigar_catalog schema ready');
  } finally {
    await pool.end();
  }
}

migrateCatalog().catch((err) => {
  console.error(err);
  process.exit(1);
});
