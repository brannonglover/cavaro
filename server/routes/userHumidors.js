const express = require('express');
const pool = require('../config/postgres');
const { resolveUserId } = require('../lib/auth');

const router = express.Router();

const HUMIDOR_COLUMNS = ['name', 'humidity', 'temperature', 'notes', 'created_at', 'updated_at'];

function normalizeHumidor(row) {
  return {
    name: row.name?.trim() || 'Unnamed',
    humidity: row.humidity != null ? parseFloat(row.humidity) || null : null,
    temperature: row.temperature != null ? parseFloat(row.temperature) || null : null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

router.get('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await pool.query(
      `SELECT ${HUMIDOR_COLUMNS.join(', ')} FROM user_humidors
       WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('User humidors GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch user humidors' });
  }
});

router.put('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const payload = Array.isArray(req.body?.humidors) ? req.body.humidors : null;
  if (!payload) return res.status(400).json({ error: 'humidors array required' });

  const humidors = payload.map(normalizeHumidor).filter((h) => h.name);
  const unique = [];
  const seen = new Set();
  for (const h of humidors) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    unique.push(h);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_humidors WHERE user_id = $1', [userId]);

    for (const h of unique) {
      await client.query(
        `INSERT INTO user_humidors (user_id, name, humidity, temperature, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, h.name, h.humidity, h.temperature, h.notes, h.created_at, h.updated_at]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, count: unique.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User humidors PUT error:', err);
    return res.status(500).json({ error: 'Failed to save user humidors' });
  } finally {
    client.release();
  }
});

module.exports = router;
