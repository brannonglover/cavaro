/**
 * Creates cigar_catalog table and seeds from cigars.json.
 * Run: node scripts/initCatalog.js (from server dir, or with path to cigars.json)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const pool = require('../config/postgres');
// Run from project root: node server/scripts/initCatalog.js
const catalogData = require(path.resolve(__dirname, '../../assets/cigars.json'));

async function initCatalog() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cigar_catalog (
        id SERIAL PRIMARY KEY,
        brand TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        wrapper TEXT,
        binder TEXT,
        filler TEXT,
        length TEXT NOT NULL,
        image TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(brand, name, length)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_brand ON cigar_catalog(brand)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON cigar_catalog(brand, name)');

    const countResult = await client.query('SELECT COUNT(*) as count FROM cigar_catalog');
    if (parseInt(countResult.rows[0].count, 10) === 0) {
      for (const cigar of catalogData) {
        const sizes = cigar.size || [{ length: '', image: '' }];
        for (const size of sizes) {
          const length = size.length || '';
          const image = size.image || cigar.image || '';
          await client.query(
            `INSERT INTO cigar_catalog (brand, name, description, wrapper, binder, filler, length, image)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (brand, name, length) DO NOTHING`,
            [
              cigar.brand || '',
              cigar.name || '',
              cigar.description || '',
              cigar.wrapper || '',
              cigar.binder || '',
              cigar.filler || '',
              length,
              image,
            ]
          );
        }
      }
      console.log(`Seeded ${catalogData.length} cigars into cigar_catalog`);
    } else {
      console.log('cigar_catalog already has data, skipping seed');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

initCatalog().catch((err) => {
  console.error(err);
  process.exit(1);
});
