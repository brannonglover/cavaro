const { extractTasteProfile } = require('./tasteVocabulary');

async function ensureCatalogTasteSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_taste_profiles (
      id SERIAL PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      flavors JSONB NOT NULL DEFAULT '[]'::jsonb,
      strength TEXT,
      source TEXT NOT NULL DEFAULT 'brand',
      evidence TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (brand, name)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_catalog_taste_profiles_brand_name
    ON catalog_taste_profiles (brand, name)
  `);
  await pool.query(`ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS flavors JSONB`);
  await pool.query(`ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS strength TEXT`);
  await pool.query(`ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS taste_source TEXT`);
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_catalog_flavors
      ON cigar_catalog USING GIN (flavors)
    `);
  } catch (err) {
    console.warn('cigar_catalog flavors index:', err.message);
  }
}

function evidenceFrom(description, flavors, strength) {
  const bits = [];
  if (flavors.length) bits.push(`notes: ${flavors.join(', ')}`);
  if (strength) bits.push(`strength: ${strength}`);
  const snippet = String(description || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (snippet) bits.push(snippet);
  return bits.join(' · ') || null;
}

function sameProfile(row, extracted) {
  const existingFlavors = Array.isArray(row?.flavors) ? row.flavors : [];
  const nextFlavors = extracted.flavors ?? [];
  if (existingFlavors.length !== nextFlavors.length) return false;
  if (existingFlavors.some((flavor, index) => flavor !== nextFlavors[index])) return false;
  return (row?.strength || null) === (extracted.strength || null);
}

async function upsertBrandTasteProfile(pool, { brand, name, description, line }, { force = false, existing } = {}) {
  const cleanBrand = brand?.trim();
  const cleanName = name?.trim();
  if (!cleanBrand || !cleanName) return { skipped: true };

  const extracted = extractTasteProfile(description, line, cleanName);
  if (!extracted.flavors.length && !extracted.strength) {
    return { skipped: true, empty: true };
  }

  let current = existing;
  if (current === undefined) {
    const result = await pool.query(
      `SELECT source, flavors, strength FROM catalog_taste_profiles WHERE brand = $1 AND name = $2`,
      [cleanBrand, cleanName]
    );
    current = result.rows[0] ?? null;
  }
  if (current?.source === 'editor') {
    return { skipped: true, editor: true };
  }
  if (!force && current && sameProfile(current, extracted)) {
    return { skipped: true, unchanged: true };
  }

  const flavorsJson = JSON.stringify(extracted.flavors);
  const evidence = evidenceFrom(description, extracted.flavors, extracted.strength);

  await pool.query(
    `INSERT INTO catalog_taste_profiles
       (brand, name, flavors, strength, source, evidence, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, 'brand', $5, NOW())
     ON CONFLICT (brand, name) DO UPDATE SET
       flavors = EXCLUDED.flavors,
       strength = COALESCE(EXCLUDED.strength, catalog_taste_profiles.strength),
       source = 'brand',
       evidence = EXCLUDED.evidence,
       updated_at = NOW()
     WHERE catalog_taste_profiles.source IS DISTINCT FROM 'editor'`,
    [cleanBrand, cleanName, flavorsJson, extracted.strength, evidence]
  );

  await pool.query(
    `UPDATE cigar_catalog
     SET flavors = $3::jsonb,
         strength = $4,
         taste_source = 'brand'
     WHERE brand = $1 AND name = $2
       AND COALESCE(taste_source, '') IS DISTINCT FROM 'editor'`,
    [cleanBrand, cleanName, flavorsJson, extracted.strength]
  );

  return { skipped: false, flavors: extracted.flavors, strength: extracted.strength };
}

async function backfillBrandTasteProfiles(pool, { brand, force = false, onProgress } = {}) {
  const params = [];
  let brandFilter = '';
  if (brand?.trim()) {
    params.push(brand.trim());
    brandFilter = 'WHERE brand = $1';
  }
  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (brand, name)
        brand, name, line, description
      FROM cigar_catalog
      ${brandFilter}
      ORDER BY brand, name, length
    `,
    params
  );

  const { rows: existingRows } = await pool.query(
    `
      SELECT brand, name, source, flavors, strength
      FROM catalog_taste_profiles
      ${brandFilter}
    `,
    params
  );
  const existingByKey = new Map(
    existingRows.map((row) => [`${row.brand}\0${row.name}`, row])
  );

  const stats = { saved: 0, empty: 0, editor: 0, unchanged: 0, total: rows.length, results: [] };
  onProgress?.({ phase: 'loaded', total: rows.length });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const result = await upsertBrandTasteProfile(pool, row, {
      force,
      existing: existingByKey.get(`${row.brand}\0${row.name}`) ?? null,
    });
    if (result.editor) stats.editor += 1;
    else if (result.unchanged) stats.unchanged += 1;
    else if (result.empty || result.skipped) stats.empty += 1;
    else {
      stats.saved += 1;
      stats.results.push({
        brand: row.brand,
        name: row.name,
        flavors: result.flavors,
        strength: result.strength,
      });
    }
    onProgress?.({
      phase: 'row',
      index: index + 1,
      total: rows.length,
      row,
      result,
    });
  }
  return stats;
}

module.exports = {
  ensureCatalogTasteSchema,
  upsertBrandTasteProfile,
  backfillBrandTasteProfiles,
};
