/**
 * Idempotent cigar_catalog schema setup (table, line column, indexes, RLS).
 * Safe to run on every deploy or on first catalog API request.
 */
const { ensureCatalogTasteSchema } = require('./catalogTaste');

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
  await ensureUniqueCatalogIndex(
    pool,
    'idx_catalog_brand_name_length',
    `CREATE UNIQUE INDEX idx_catalog_brand_name_length
     ON cigar_catalog (brand, name, length)`,
    `
      SELECT 1
      FROM cigar_catalog
      GROUP BY brand, name, length
      HAVING COUNT(*) > 1
      LIMIT 1
    `
  );
  await ensureUniqueCatalogIndex(
    pool,
    'idx_catalog_brand_name_size_length',
    `CREATE UNIQUE INDEX idx_catalog_brand_name_size_length
     ON cigar_catalog (brand, name, COALESCE(size_name, ''), length)`
  );
  try {
    await pool.query('ALTER TABLE cigar_catalog DISABLE ROW LEVEL SECURITY');
  } catch (err) {
    console.warn('cigar_catalog RLS disable:', err.message);
  }
  await ensureCatalogTasteSchema(pool);
}

async function indexExists(pool, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [name]
  );
  return rows.length > 0;
}

async function ensureUniqueCatalogIndex(pool, name, createSql, duplicateSql) {
  if (await indexExists(pool, name)) return;
  if (duplicateSql) {
    const { rows } = await pool.query(duplicateSql);
    if (rows.length) return;
  }
  try {
    await pool.query(createSql);
  } catch (err) {
    console.warn(`${name}:`, err.message);
  }
}

module.exports = { ensureCatalogSchema };
