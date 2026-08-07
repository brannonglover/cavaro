const express = require('express');
const router = express.Router();
const pool = require('../config/postgres');
const { ensureCatalogSchema } = require('../lib/catalogSchema');

let schemaReady = null;
function readyCatalogSchema() {
  if (!schemaReady) {
    schemaReady = ensureCatalogSchema(pool).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// GET /api/catalog - fetch all cigars for shared catalog
router.get('/', async (req, res) => {
  try {
    await readyCatalogSchema();
    const result = await pool.query(
      'SELECT id, brand, name, line, description, wrapper, binder, filler, length, size_name, image FROM cigar_catalog ORDER BY brand, name, length, size_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Catalog GET error:', err);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// POST /api/catalog - add a new cigar to the shared catalog (from any user)
router.post('/', async (req, res) => {
  console.log('Catalog POST received', { brand: req.body?.brand, name: req.body?.name });
  const { brand, name, line, description, wrapper, binder, filler, length, size_name, image } = req.body;
  if (!brand?.trim() || !name?.trim() || !length?.trim()) {
    return res.status(400).json({ error: 'Brand, name, and length are required' });
  }
  try {
    await readyCatalogSchema();
    const result = await pool.query(
      `INSERT INTO cigar_catalog (brand, name, line, description, wrapper, binder, filler, length, size_name, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (brand, name, length) DO UPDATE SET
         line = EXCLUDED.line,
         description = EXCLUDED.description,
         wrapper = EXCLUDED.wrapper,
         binder = EXCLUDED.binder,
         filler = EXCLUDED.filler,
         size_name = COALESCE(EXCLUDED.size_name, cigar_catalog.size_name),
         image = EXCLUDED.image
       RETURNING id, brand, name, line, description, wrapper, binder, filler, length, size_name, image`,
      [
        brand.trim(),
        name.trim(),
        (line || '').trim() || null,
        description || '',
        wrapper || '',
        binder || '',
        filler || '',
        length.trim(),
        (size_name || '').trim() || null,
        image || '',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Catalog POST error:', err.message || err, err.stack);
    const detail = process.env.NODE_ENV !== 'production' ? err.message : undefined;
    res.status(500).json({
      error: 'Failed to add cigar to catalog',
      ...(detail && { detail }),
    });
  }
});

module.exports = router;
