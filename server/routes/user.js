const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');
const { syncSubscriptionTierFromApple, iapConfigured } = require('../lib/appleAppStore');
const { effectiveTierForUser, isPremiumTestUser } = require('../lib/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const router = express.Router();

/**
 * GET /api/user/tier
 * Returns { tier: 'free' | 'premium' }
 * Requires: Authorization: Bearer <supabase_access_token>
 */
router.get('/tier', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabase) {
    return res.status(401).json({ tier: 'free' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ tier: 'free' });
    }

    await pool.query(
      `INSERT INTO user_profiles (id, tier, updated_at)
       VALUES ($1, 'free', NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [user.id]
    );

    if (iapConfigured() && !isPremiumTestUser(user)) {
      await syncSubscriptionTierFromApple(pool, user.id);
    }

    const { rows } = await pool.query(
      'SELECT tier FROM user_profiles WHERE id = $1',
      [user.id]
    );
    let storedTier = rows[0]?.tier;
    if (isPremiumTestUser(user) && storedTier !== 'premium') {
      await pool.query(
        `UPDATE user_profiles SET tier = 'premium', updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      storedTier = 'premium';
    }
    const tier = effectiveTierForUser(user, storedTier);
    return res.json({ tier });
  } catch (err) {
    console.error('Tier fetch error:', err);
    return res.status(500).json({ tier: 'free' });
  }
});

/**
 * DELETE /api/user/account
 * Permanently deletes the user: Postgres profile/reviews, Supabase Auth.
 * Requires: Authorization: Bearer <supabase_access_token>
 */
router.delete('/account', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabase) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    await pool.query('DELETE FROM cigar_reviews WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_cigars WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM user_humidors WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM user_cellared_items WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM user_journal_entries WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM user_profiles WHERE id = $1', [userId]);

    const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('Supabase admin deleteUser:', delErr);
      return res.status(500).json({ error: delErr.message || 'Failed to delete account' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete account' });
  }
});

module.exports = router;
