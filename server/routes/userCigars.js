const crypto = require('node:crypto');
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
 * Current snapshot revision for a user. Absent row means 0, which is what a
 * client that has never seen a revision will send.
 */
async function readRevision(client, userId) {
  const { rows } = await client.query(
    'SELECT revision FROM user_collection_revision WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.revision != null ? Number(rows[0].revision) : 0;
}

/**
 * During the rollout window, set ALLOW_UNVERSIONED_SNAPSHOT_WRITES=1 so builds
 * already in the field (which send no baseRevision) keep syncing. Once those
 * are gone, unset it and every write must carry a revision.
 */
const ALLOW_UNVERSIONED = process.env.ALLOW_UNVERSIONED_SNAPSHOT_WRITES === '1';

/**
 * Rollout telemetry: how many snapshot writes still arrive without a revision.
 *
 * Persisted per user per day in Postgres rather than counted in memory. The
 * decision this feeds — when ALLOW_UNVERSIONED_SNAPSHOT_WRITES can be switched
 * off — needs a real observation window, and "zero since this process started"
 * does not establish "zero in the last seven days" across restarts and
 * instances.
 *
 * Best-effort: a telemetry failure must never fail a user's sync, so it is
 * written outside the snapshot transaction and its errors are swallowed.
 */
async function recordUnversionedWrite(userId) {
  // Structured so it is also greppable in Railway's retained logs, which are
  // an independent record if the table is ever unavailable.
  console.warn(JSON.stringify({ event: 'unversioned_snapshot_write', userId }));
  try {
    await pool.query(
      `INSERT INTO unversioned_snapshot_writes (user_id, day, writes, last_seen_at)
       VALUES ($1, CURRENT_DATE, 1, NOW())
       ON CONFLICT (user_id, day) DO UPDATE
         SET writes = unversioned_snapshot_writes.writes + 1,
             last_seen_at = NOW()`,
      [userId]
    );
  } catch (err) {
    console.error('unversioned-write telemetry failed:', err.message);
  }
}

/**
 * Aggregate the rollout signal over real time windows, plus how long we have
 * actually been observing — a zero count is only meaningful once the window is
 * fully covered.
 */
async function unversionedWriteStats() {
  const [windows, observation] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(writes) FILTER (WHERE day > CURRENT_DATE - 7), 0)::bigint  AS writes_7d,
         COUNT(DISTINCT user_id) FILTER (WHERE day > CURRENT_DATE - 7)           AS users_7d,
         COALESCE(SUM(writes) FILTER (WHERE day > CURRENT_DATE - 30), 0)::bigint AS writes_30d,
         COUNT(DISTINCT user_id) FILTER (WHERE day > CURRENT_DATE - 30)          AS users_30d,
         MAX(last_seen_at)                                                       AS last_seen_at
       FROM unversioned_snapshot_writes`
    ),
    pool.query('SELECT started_at FROM unversioned_write_observation WHERE id = 1'),
  ]);

  const w = windows.rows[0] ?? {};
  const startedAt = observation.rows[0]?.started_at ?? null;
  const observedDays = startedAt
    ? (Date.now() - new Date(startedAt).getTime()) / 86400000
    : 0;
  const writes7d = Number(w.writes_7d ?? 0);

  return {
    allowUnversioned: ALLOW_UNVERSIONED,
    observationStartedAt: startedAt,
    observedDays: Number(observedDays.toFixed(2)),
    last7Days: { writes: writes7d, distinctUsers: Number(w.users_7d ?? 0) },
    last30Days: { writes: Number(w.writes_30d ?? 0), distinctUsers: Number(w.users_30d ?? 0) },
    lastSeenAt: w.last_seen_at ?? null,
    // The actual gate for turning compatibility off: a full week observed AND
    // nothing seen in it. False while the window is still filling, even at zero.
    safeToDisableLegacyWrites: observedDays >= 7 && writes7d === 0,
  };
}

/**
 * Operational endpoints are administrator-only. Ordinary authenticated users
 * have no reason to read rollout telemetry, so this does not go through
 * resolveUserId at all — it requires a separate shared ops token.
 *
 * Fails closed: with OPS_API_TOKEN unset the endpoint is unavailable rather
 * than open, so a missing variable can never silently expose it.
 */
function isOpsRequest(req) {
  const expected = process.env.OPS_API_TOKEN || '';
  if (!expected) return false;
  const provided = String(req.headers['x-ops-token'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/user/cigars/revision-stats
 * Administrator-only. Aggregate counts for the rollout window; no user data.
 */
router.get('/revision-stats', async (req, res) => {
  if (!isOpsRequest(req)) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    return res.json(await unversionedWriteStats());
  } catch (err) {
    console.error('revision-stats error:', err);
    return res.status(500).json({ error: 'Failed to read telemetry' });
  }
});

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
    // Revision travels in a header, not the body: every existing client reads
    // this response as a bare array and changing that shape would break them.
    res.set('X-Collection-Revision', String(await readRevision(pool, userId)));
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

  const hasBaseRevision = Number.isInteger(req.body?.baseRevision);
  if (!hasBaseRevision) await recordUnversionedWrite(userId);
  if (!hasBaseRevision && !ALLOW_UNVERSIONED) {
    return res.status(428).json({
      error: 'baseRevision required',
      hint: 'GET /api/user/cigars and resend with its X-Collection-Revision value',
    });
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

    // Lock the revision row first so two concurrent replaces cannot both pass
    // the check. A stale caller is rejected before anything is modified.
    const { rows: revRows } = await client.query(
      `INSERT INTO user_collection_revision (user_id, revision)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING revision`,
      [userId]
    );
    const currentRevision = Number(revRows[0].revision);

    if (hasBaseRevision && req.body.baseRevision !== currentRevision) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'revision_conflict',
        currentRevision,
      });
    }

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

    const { rows: bumped } = await client.query(
      `UPDATE user_collection_revision
          SET revision = revision + 1, updated_at = NOW()
        WHERE user_id = $1
        RETURNING revision`,
      [userId]
    );

    await client.query('COMMIT');
    res.set('X-Collection-Revision', String(bumped[0].revision));
    return res.json({ ok: true, count: uniqueCigars.length, revision: Number(bumped[0].revision) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User cigars PUT error:', err);
    return res.status(500).json({ error: 'Failed to save user cigars' });
  } finally {
    client.release();
  }
});

module.exports = router;
