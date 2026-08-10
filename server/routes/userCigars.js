const express = require('express');
const pool = require('../config/postgres');
const { resolveUserId } = require('../lib/auth');

const router = express.Router();

const CIGAR_COLUMNS = [
  'brand', 'name', 'length', 'line', 'description', 'wrapper', 'binder', 'filler', 'image',
  'collection', 'is_favorite', 'quantity', 'smoked_date', 'smoke_notes', 'favorite_notes',
  'flavor_profile', 'strength_profile', 'construction_quality', 'flavor_changes',
  'date_added', 'humidor_name',
];

function normalizeCigar(row) {
  return {
    brand: row.brand?.trim() || '',
    name: row.name?.trim() || '',
    length: row.length?.trim() || '',
    line: row.line?.trim() || null,
    description: row.description ?? null,
    wrapper: row.wrapper ?? null,
    binder: row.binder ?? null,
    filler: row.filler ?? null,
    image: row.image ?? null,
    collection: row.collection === 'likes' || row.collection === 'dislikes' ? row.collection : 'cavaro',
    is_favorite: !!row.is_favorite,
    quantity: Math.max(0, Number.isFinite(parseInt(row.quantity, 10)) ? parseInt(row.quantity, 10) : 1),
    smoked_date: row.smoked_date ?? null,
    smoke_notes: row.smoke_notes ?? null,
    favorite_notes: row.favorite_notes ?? null,
    flavor_profile: row.flavor_profile ?? null,
    strength_profile: row.strength_profile ?? null,
    construction_quality: row.construction_quality ?? null,
    flavor_changes: row.flavor_changes ?? null,
    date_added: row.date_added ?? null,
    humidor_name: row.humidor_name?.trim() || null,
  };
}

function isValidCigar(cigar) {
  return !!(cigar.brand && cigar.name && cigar.length);
}

/**
 * GET /api/user/cigars
 * Returns all synced cigars for the authenticated user.
 */
router.get('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${CIGAR_COLUMNS.join(', ')}
       FROM user_cigars
       WHERE user_id = $1
       ORDER BY brand, name, length`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('User cigars GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch user cigars' });
  }
});

/**
 * PUT /api/user/cigars
 * Replaces the user's full synced cigars snapshot.
 * Body: { cigars: [...] }
 */
router.put('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = Array.isArray(req.body?.cigars) ? req.body.cigars : null;
  if (!payload) {
    return res.status(400).json({ error: 'cigars array required' });
  }

  const cigars = payload.map(normalizeCigar).filter(isValidCigar);
  const uniqueCigars = [];
  const seen = new Set();
  for (const cigar of cigars) {
    const key = `${cigar.brand}::${cigar.name}::${cigar.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCigars.push(cigar);
  }
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_cigars WHERE user_id = $1', [userId]);

    for (const cigar of uniqueCigars) {
      await client.query(
        `INSERT INTO user_cigars (
          user_id, brand, name, length, line, description, wrapper, binder, filler, image,
          collection, is_favorite, quantity, smoked_date, smoke_notes, favorite_notes,
          flavor_profile, strength_profile, construction_quality, flavor_changes,
          date_added, humidor_name, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, NOW()
        )`,
        [
          userId,
          cigar.brand, cigar.name, cigar.length, cigar.line,
          cigar.description, cigar.wrapper, cigar.binder, cigar.filler, cigar.image,
          cigar.collection, cigar.is_favorite, cigar.quantity,
          cigar.smoked_date, cigar.smoke_notes, cigar.favorite_notes,
          cigar.flavor_profile, cigar.strength_profile, cigar.construction_quality, cigar.flavor_changes,
          cigar.date_added, cigar.humidor_name,
        ]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, count: uniqueCigars.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User cigars PUT error:', err);
    return res.status(500).json({ error: 'Failed to save user cigars' });
  } finally {
    client.release();
  }
});

module.exports = router;
