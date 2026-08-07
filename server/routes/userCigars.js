const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const router = express.Router();

const SYNCABLE_WHERE =
  "collection IN ('likes', 'dislikes') OR (collection = 'cavaro' AND is_favorite = true)";

const CIGAR_COLUMNS = [
  'brand', 'name', 'length', 'line', 'description', 'wrapper', 'binder', 'filler', 'image',
  'collection', 'is_favorite', 'quantity', 'smoked_date', 'smoke_notes', 'favorite_notes',
  'flavor_profile', 'strength_profile', 'construction_quality', 'flavor_changes',
];

async function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

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
    quantity: Math.max(0, parseInt(row.quantity, 10) || 1),
    smoked_date: row.smoked_date ?? null,
    smoke_notes: row.smoke_notes ?? null,
    favorite_notes: row.favorite_notes ?? null,
    flavor_profile: row.flavor_profile ?? null,
    strength_profile: row.strength_profile ?? null,
    construction_quality: row.construction_quality ?? null,
    flavor_changes: row.flavor_changes ?? null,
  };
}

function isSyncableCigar(cigar) {
  if (!cigar.brand || !cigar.name || !cigar.length) return false;
  return cigar.collection === 'likes'
    || cigar.collection === 'dislikes'
    || (cigar.collection === 'cavaro' && cigar.is_favorite);
}

/**
 * GET /api/user/cigars
 * Returns favorites/dislikes for the authenticated user.
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
       WHERE user_id = $1 AND (${SYNCABLE_WHERE})
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
 * Replaces the user's synced favorites/dislikes snapshot.
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

  const cigars = payload.map(normalizeCigar).filter(isSyncableCigar);
  // Deduplicate by unique key — local snapshots can contain repeats.
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
          flavor_profile, strength_profile, construction_quality, flavor_changes, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, NOW()
        )`,
        [
          userId,
          cigar.brand,
          cigar.name,
          cigar.length,
          cigar.line,
          cigar.description,
          cigar.wrapper,
          cigar.binder,
          cigar.filler,
          cigar.image,
          cigar.collection,
          cigar.is_favorite,
          cigar.quantity,
          cigar.smoked_date,
          cigar.smoke_notes,
          cigar.favorite_notes,
          cigar.flavor_profile,
          cigar.strength_profile,
          cigar.construction_quality,
          cigar.flavor_changes,
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
