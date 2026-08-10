const express = require('express');
const pool = require('../config/postgres');
const { resolveUserId } = require('../lib/auth');

const router = express.Router();

const JOURNAL_COLUMNS = [
  'cigar_brand', 'cigar_name', 'cigar_length', 'smoked_date',
  'rating', 'would_buy_again', 'notes',
  'liked_flavors', 'disliked_flavors', 'strength_feedback',
  'draw', 'burn', 'finish',
  'created_at', 'updated_at',
];

function normalizeJournalEntry(row) {
  return {
    cigar_brand: row.cigar_brand?.trim() || '',
    cigar_name: row.cigar_name?.trim() || '',
    cigar_length: row.cigar_length?.trim() || '',
    smoked_date: row.smoked_date || new Date().toISOString().slice(0, 10),
    rating: row.rating != null ? parseInt(row.rating, 10) : null,
    would_buy_again: row.would_buy_again != null ? !!row.would_buy_again : null,
    notes: row.notes ?? null,
    liked_flavors: row.liked_flavors ?? '[]',
    disliked_flavors: row.disliked_flavors ?? '[]',
    strength_feedback: row.strength_feedback ?? null,
    draw: row.draw ?? null,
    burn: row.burn ?? null,
    finish: row.finish ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function isValidJournalEntry(entry) {
  return !!(entry.cigar_brand && entry.cigar_name && entry.cigar_length && entry.smoked_date);
}

router.get('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await pool.query(
      `SELECT ${JOURNAL_COLUMNS.join(', ')} FROM user_journal_entries
       WHERE user_id = $1 ORDER BY smoked_date DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('User journal GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

router.put('/', async (req, res) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const payload = Array.isArray(req.body?.entries) ? req.body.entries : null;
  if (!payload) return res.status(400).json({ error: 'entries array required' });

  const entries = payload.map(normalizeJournalEntry).filter(isValidJournalEntry);

  const unique = [];
  const seen = new Set();
  for (const e of entries) {
    const key = `${e.cigar_brand}::${e.cigar_name}::${e.cigar_length}::${e.smoked_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_journal_entries WHERE user_id = $1', [userId]);

    for (const e of unique) {
      await client.query(
        `INSERT INTO user_journal_entries (
          user_id, cigar_brand, cigar_name, cigar_length, smoked_date,
          rating, would_buy_again, notes,
          liked_flavors, disliked_flavors, strength_feedback,
          draw, burn, finish, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          userId, e.cigar_brand, e.cigar_name, e.cigar_length, e.smoked_date,
          e.rating, e.would_buy_again, e.notes,
          e.liked_flavors, e.disliked_flavors, e.strength_feedback,
          e.draw, e.burn, e.finish, e.created_at, e.updated_at,
        ]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, count: unique.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User journal PUT error:', err);
    return res.status(500).json({ error: 'Failed to save journal entries' });
  } finally {
    client.release();
  }
});

module.exports = router;
