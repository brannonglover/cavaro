const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');
const {
  iapConfigured,
  getIapConfigIssues,
  formatAppleApiError,
  getTransactionFromApple,
  assertTransactionMatchesUser,
  syncSubscriptionTierFromApple,
} = require('../lib/appleAppStore');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const router = express.Router();

/**
 * GET /api/subscription/status
 * Returns whether Apple IAP verification is configured (Railway env check).
 */
router.get('/status', (_req, res) => {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  missing.push(...getIapConfigIssues());
  res.json({
    configured: missing.length === 0 && iapConfigured(),
    missing,
  });
});

/**
 * POST /api/subscription/apple/verify
 * Body: { transactionId: string }
 * Links an Apple subscription transaction to the signed-in user and sets tier premium.
 */
router.post('/apple/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const transactionId = req.body?.transactionId;

  if (!token || !supabase || !transactionId) {
    return res.status(400).json({ error: 'Missing auth or transactionId' });
  }
  if (!iapConfigured()) {
    const issues = getIapConfigIssues();
    const detail = issues.length > 0 ? issues.join('; ') : 'Apple In-App Purchase is not configured on the server';
    return res.status(503).json({ error: detail });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `INSERT INTO user_profiles (id, tier, updated_at)
       VALUES ($1, 'free', NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [user.id]
    );

    const { tx } = await getTransactionFromApple(String(transactionId).trim());
    assertTransactionMatchesUser(tx, user.id);

    const origId = tx.originalTransactionId;
    if (!origId) {
      return res.status(400).json({ error: 'Missing original transaction id' });
    }

    const { rows: conflict } = await pool.query(
      'SELECT id FROM user_profiles WHERE apple_original_transaction_id = $1 AND id <> $2',
      [origId, user.id]
    );
    if (conflict.length > 0) {
      return res.status(409).json({
        error: 'This Apple subscription is already linked to another Cavaro account',
      });
    }

    await pool.query(
      `UPDATE user_profiles
       SET tier = 'premium', apple_original_transaction_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [user.id, origId]
    );

    return res.json({ tier: 'premium' });
  } catch (err) {
    console.error('Apple verify error:', err);
    return res.status(400).json({ error: formatAppleApiError(err) || 'Verification failed' });
  }
});

/**
 * POST /api/subscription/apple/restore
 * Client has already restored with StoreKit; optionally pass transactionId from active entitlement.
 * Body: { transactionId?: string } — if omitted, server only syncs existing apple_original_transaction_id.
 */
router.post('/apple/restore', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const transactionId = req.body?.transactionId;

  if (!token || !supabase) {
    return res.status(503).json({ error: 'Not configured' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `INSERT INTO user_profiles (id, tier, updated_at)
       VALUES ($1, 'free', NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [user.id]
    );

    const { rows: beforeRows } = await pool.query('SELECT tier FROM user_profiles WHERE id = $1', [user.id]);
    const beforeTier = beforeRows[0]?.tier === 'premium' ? 'premium' : 'free';

    if (transactionId && iapConfigured()) {
      try {
        const { tx } = await getTransactionFromApple(String(transactionId).trim());
        assertTransactionMatchesUser(tx, user.id);
        const origId = tx.originalTransactionId;
        if (origId) {
          const { rows: conflict } = await pool.query(
            'SELECT id FROM user_profiles WHERE apple_original_transaction_id = $1 AND id <> $2',
            [origId, user.id]
          );
          if (conflict.length === 0) {
            await pool.query(
              `UPDATE user_profiles
               SET tier = 'premium', apple_original_transaction_id = $2, updated_at = NOW()
               WHERE id = $1`,
              [user.id, origId]
            );
            return res.json({
              tier: 'premium',
              restored: beforeTier !== 'premium',
            });
          }
        }
      } catch (e) {
        console.warn('Apple restore verify:', e.message);
        if (/asymmetric key|ES256|invalid for ES256|truncated|must be the full/i.test(e.message || '')) {
          return res.status(503).json({ error: formatAppleApiError(e) });
        }
      }
    }

    if (iapConfigured()) {
      await syncSubscriptionTierFromApple(pool, user.id);
    }

    const { rows } = await pool.query('SELECT tier FROM user_profiles WHERE id = $1', [user.id]);
    const finalTier = rows[0]?.tier === 'premium' ? 'premium' : 'free';
    return res.json({
      tier: finalTier,
      restored: finalTier === 'premium' && beforeTier !== 'premium',
    });
  } catch (err) {
    console.error('Apple restore error:', err);
    return res.status(500).json({ error: formatAppleApiError(err) || 'Restore failed' });
  }
});

module.exports = router;
