const express = require('express');
const pool = require('../config/postgres');
const { resolveUserId } = require('../lib/auth');

const router = express.Router();

const CELLARED_COLUMNS = [
  'cigar_brand', 'cigar_name', 'cigar_length', 'humidor_name',
  'quantity', 'started_at', 'target_months', 'notes',
  'created_at', 'updated_at',
];

function normalizeCellaredItem(row) {
  return {
    cigar_brand: row.cigar_brand?.trim() || '',
    cigar_name: row.cigar_name?.trim() || '',
    cigar_length: row.cigar_length?.trim() || '',
    humidor_name: row.humidor_name?.trim() || null,
    quantity: Math.max(1, parseInt(row.quantity, 10) || 1),
    started_at: row.started_at || new Date().toISOString().slice(0, 10),
    target_months: row.target_months != null ? parseInt(row.target_months, 10) || null : null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function isValidCellaredItem(item) {
  return !!(item.cigar_brand && item.cigar_name && item.cigar_length);
}

router.get('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await pool.query(
      `SELECT ${CELLARED_COLUMNS.join(', ')} FROM user_cellared_items
       WHERE user_id = $1 ORDER BY started_at`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('User cellared GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch cellared items' });
  }
});

router.put('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const payload = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!payload) return res.status(400).json({ error: 'items array required' });

  const items = payload.map(normalizeCellaredItem).filter(isValidCellaredItem);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_cellared_items WHERE user_id = $1', [userId]);

    for (const item of items) {
      await client.query(
        `INSERT INTO user_cellared_items (
          user_id, cigar_brand, cigar_name, cigar_length, humidor_name,
          quantity, started_at, target_months, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId, item.cigar_brand, item.cigar_name, item.cigar_length, item.humidor_name,
          item.quantity, item.started_at, item.target_months, item.notes,
          item.created_at, item.updated_at,
        ]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, count: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User cellared PUT error:', err);
    return res.status(500).json({ error: 'Failed to save cellared items' });
  } finally {
    client.release();
  }
});

module.exports = router;
