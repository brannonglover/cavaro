/**
 * Creates cigar_reviews table for shared community reviews.
 * Run: node scripts/initReviews.js (from server dir)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function initReviews() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cigar_reviews (
        id SERIAL PRIMARY KEY,
        catalog_id INTEGER NOT NULL REFERENCES cigar_catalog(id) ON DELETE CASCADE,
        user_id UUID,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        flavor_profile TEXT,
        favorite_notes TEXT,
        strength_profile TEXT,
        construction_quality TEXT,
        flavor_changes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_catalog ON cigar_reviews(catalog_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_user ON cigar_reviews(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_created ON cigar_reviews(created_at DESC)');
    console.log('cigar_reviews table ready');
  } finally {
    client.release();
    await pool.end();
  }
}

initReviews().catch((err) => {
  console.error(err);
  process.exit(1);
});
