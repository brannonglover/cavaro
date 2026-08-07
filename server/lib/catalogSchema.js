/**
 * Idempotent cigar_catalog schema setup (table, line column, indexes, RLS).
 * Safe to run on every deploy or on first catalog API request.
 */
async function ensureCatalogSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cigar_catalog (
      id SERIAL PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      line TEXT,
      description TEXT,
      wrapper TEXT,
      binder TEXT,
      filler TEXT,
      length TEXT NOT NULL,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS line TEXT');
  await pool.query('ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS size_name TEXT');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_catalog_brand ON cigar_catalog(brand)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON cigar_catalog(brand, name)');
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_brand_name_length
      ON cigar_catalog (brand, name, length)
    `);
  } catch (err) {
    console.warn('cigar_catalog unique index:', err.message);
  }
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_brand_name_size_length
      ON cigar_catalog (brand, name, COALESCE(size_name, ''), length)
    `);
  } catch (err) {
    console.warn('cigar_catalog size unique index:', err.message);
  }
  try {
    await pool.query('ALTER TABLE cigar_catalog DISABLE ROW LEVEL SECURITY');
  } catch (err) {
    console.warn('cigar_catalog RLS disable:', err.message);
  }
}

module.exports = { ensureCatalogSchema };
