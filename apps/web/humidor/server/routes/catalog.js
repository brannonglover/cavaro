const express = require('express');
const router = express.Router();
const pool = require('../config/postgres');

// GET /api/catalog - fetch all cigars for shared catalog
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, brand, name, description, wrapper, binder, filler, length, image FROM cigar_catalog ORDER BY brand, name, length'
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
  const { brand, name, description, wrapper, binder, filler, length, image } = req.body;
  if (!brand?.trim() || !name?.trim() || !length?.trim()) {
    return res.status(400).json({ error: 'Brand, name, and length are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO cigar_catalog (brand, name, description, wrapper, binder, filler, length, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (brand, name, length) DO UPDATE SET
         description = EXCLUDED.description,
         wrapper = EXCLUDED.wrapper,
         binder = EXCLUDED.binder,
         filler = EXCLUDED.filler,
         image = EXCLUDED.image
       RETURNING id, brand, name, description, wrapper, binder, filler, length, image`,
      [
        brand.trim(),
        name.trim(),
        description || '',
        wrapper || '',
        binder || '',
        filler || '',
        length.trim(),
        image || '',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Catalog POST error:', err);
    res.status(500).json({ error: 'Failed to add cigar to catalog' });
  }
});

module.exports = router;
