const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');
const { effectiveTierForUser } = require('../lib/auth');
const { ensureCatalogSchema } = require('../lib/catalogSchema');
const { canonicalLabelsFromKeywords } = require('../lib/tasteVocabulary');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const FREE_SEARCH_LIMIT_PER_DAY = 3;

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

/**
 * Resolve user and tier from Authorization header.
 * Returns { userId, tier } or null if unauthenticated.
 */
async function resolveUserAndTier(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  await pool.query(
    `INSERT INTO user_profiles (id, tier, updated_at)
     VALUES ($1, 'free', NOW())
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
    [user.id]
  );

  const { rows } = await pool.query(
    'SELECT tier FROM user_profiles WHERE id = $1',
    [user.id]
  );
  const tier = effectiveTierForUser(user, rows[0]?.tier);
  return { userId: user.id, tier };
}

/**
 * Check and increment free user's daily search count.
 * Returns { allowed: boolean, remaining: number }.
 */
async function checkAndIncrementSearchCount(userId) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const { rows } = await pool.query(
    'SELECT search_count, search_count_reset_at FROM user_profiles WHERE id = $1',
    [userId]
  );
  let count = rows[0]?.search_count ?? 0;
  let resetAt = rows[0]?.search_count_reset_at ? new Date(rows[0].search_count_reset_at) : null;

  if (!resetAt || resetAt < todayStart) {
    count = 0;
    resetAt = now;
    await pool.query(
      'UPDATE user_profiles SET search_count = 0, search_count_reset_at = $1, updated_at = NOW() WHERE id = $2',
      [resetAt, userId]
    );
  }

  if (count >= FREE_SEARCH_LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }

  await pool.query(
    'UPDATE user_profiles SET search_count = search_count + 1, updated_at = NOW() WHERE id = $1',
    [userId]
  );
  return { allowed: true, remaining: FREE_SEARCH_LIMIT_PER_DAY - count - 1 };
}

const TASTE_SEARCH_COLS = [
  'c.description',
  'c.wrapper',
  'c.binder',
  'c.filler',
  'c.name',
  'c.brand',
  'r.flavor_profile',
  'r.favorite_notes',
  'r.strength_profile',
  'r.construction_quality',
  'r.flavor_changes',
];

/**
 * Build LIKE conditions for taste search across catalog + review fields.
 * Keywords are OR'd (any match).
 */
function buildTasteSearchConditions(keywords) {
  const conditions = [];
  const params = [];
  const flavorLabels = canonicalLabelsFromKeywords(keywords);
  const unprofiled = `(c.flavors IS NULL OR jsonb_typeof(c.flavors) <> 'array' OR jsonb_array_length(c.flavors) = 0)`;

  if (flavorLabels.length) {
    params.push(flavorLabels);
    conditions.push(
      `(c.flavors IS NOT NULL AND jsonb_typeof(c.flavors) = 'array' AND jsonb_array_length(c.flavors) > 0 AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(c.flavors) AS flavor
          WHERE flavor = ANY($${params.length}::text[])
        ))`
    );
  }

  const textParts = [];
  for (const term of keywords) {
    params.push(`%${term}%`);
    const paramPlaceholder = `$${params.length}`;
    const colConditions = TASTE_SEARCH_COLS.map(
      (col) => `COALESCE(${col}, '') ILIKE ${paramPlaceholder}`
    );
    textParts.push(`(${colConditions.join(' OR ')})`);
  }
  const textSql = textParts.join(' OR ');
  if (textSql) {
    conditions.push(flavorLabels.length ? `(${unprofiled} AND (${textSql}))` : `(${textSql})`);
  }

  return { where: conditions.join(' OR ') || 'FALSE', params };
}

function buildCigarNameConditions(keywords) {
  const conditions = [];
  const params = [];
  for (const term of keywords) {
    params.push(`%${term}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(c.brand ILIKE ${p} OR c.name ILIKE ${p} OR COALESCE(c.line, '') ILIKE ${p})`
    );
  }
  return { where: conditions.join(' AND '), params };
}

const SEARCH_SELECT = `
  SELECT c.id, c.brand, c.name, c.line, c.description, c.wrapper, c.binder, c.filler,
         c.length, c.size_name, c.image, c.flavors, c.strength, c.taste_source,
         STRING_AGG(DISTINCT NULLIF(BTRIM(r.flavor_profile), ''), ' · ') AS community_flavors
  FROM cigar_catalog c
  LEFT JOIN cigar_reviews r ON r.catalog_id = c.id
`;

// GET /api/reviews/search?q=earthy,woody,pepper&type=taste|cigar
// Requires: Authorization: Bearer <supabase_access_token>
// Free users: 3 searches per day. Returns 429 when limit exceeded.
router.get('/search', async (req, res) => {
  try {
    await readyCatalogSchema();
    const auth = await resolveUserAndTier(req);
    if (!auth) {
      return res.status(401).json({ error: 'Sign in required to search' });
    }

    const q = (req.query.q || '').trim();
    const type = String(req.query.type || 'taste').toLowerCase() === 'cigar' ? 'cigar' : 'taste';
    const keywords = q
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      return res.json([]);
    }

    if (auth.tier === 'free') {
      const { allowed } = await checkAndIncrementSearchCount(auth.userId);
      if (!allowed) {
        return res.status(429).json({
          error: 'Daily search limit reached',
          searchesRemaining: 0,
          message: 'Free users get 3 searches per day. Upgrade to premium for unlimited searches.',
        });
      }
    }

    const built = type === 'cigar'
      ? buildCigarNameConditions(keywords)
      : buildTasteSearchConditions(keywords);

    const result = await pool.query(
      `WITH matches AS (
         ${SEARCH_SELECT}
         WHERE ${built.where}
         GROUP BY c.id
       )
       SELECT DISTINCT ON (lower(brand), lower(name)) *
       FROM matches
       ORDER BY lower(brand), lower(name),
                CASE WHEN COALESCE(image, '') ILIKE '%.jpg%' THEN 0 ELSE 1 END,
                length NULLS LAST
       LIMIT 40`,
      built.params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Reviews search error:', err);
    res.status(500).json({ error: 'Failed to search reviews' });
  }
});

// GET /api/reviews/top?limit=5
// Requires: Authorization: Bearer <supabase_access_token>
// Premium only. Free users get 403.
router.get('/top', async (req, res) => {
  try {
    const auth = await resolveUserAndTier(req);
    if (!auth) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    if (auth.tier === 'free') {
      return res.status(403).json({ error: 'Premium required to view top cigars' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const result = await pool.query(
      `SELECT c.id, c.brand, c.name, c.description, c.wrapper, c.binder, c.filler, c.length, c.image,
              ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM cigar_reviews r
       JOIN cigar_catalog c ON c.id = r.catalog_id
       WHERE r.rating IS NOT NULL
       GROUP BY c.id, c.brand, c.name, c.description, c.wrapper, c.binder, c.filler, c.length, c.image
       HAVING COUNT(r.id) >= 1
       ORDER BY avg_rating DESC, review_count DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Reviews top error:', err);
    res.status(500).json({ error: 'Failed to fetch top cigars' });
  }
});

// POST /api/reviews - submit a review
router.post('/', async (req, res) => {
  const { catalog_id, brand, name, length, user_id, rating, flavor_profile, favorite_notes, strength_profile, construction_quality, flavor_changes } = req.body;
  let resolvedCatalogId = catalog_id;
  if (!resolvedCatalogId && brand?.trim() && name?.trim() && length?.trim()) {
    const lookup = await pool.query(
      'SELECT id FROM cigar_catalog WHERE brand = $1 AND name = $2 AND length = $3',
      [brand.trim(), name.trim(), length.trim()]
    );
    resolvedCatalogId = lookup.rows[0]?.id;
  }
  if (!resolvedCatalogId) {
    return res.status(400).json({
      error: catalog_id
        ? 'Invalid catalog_id'
        : 'Cigar not found in catalog. Only cigars from the catalog can be shared.',
    });
  }
  const ratingVal = rating != null ? parseInt(rating, 10) : null;
  if (ratingVal != null && (ratingVal < 1 || ratingVal > 5)) {
    return res.status(400).json({ error: 'rating must be 1-5' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO cigar_reviews (catalog_id, user_id, rating, flavor_profile, favorite_notes, strength_profile, construction_quality, flavor_changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, catalog_id, rating, created_at`,
      [
        resolvedCatalogId,
        user_id || null,
        ratingVal,
        flavor_profile?.trim() || null,
        favorite_notes?.trim() || null,
        strength_profile?.trim() || null,
        construction_quality?.trim() || null,
        flavor_changes?.trim() || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Reviews POST error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

module.exports = router;
