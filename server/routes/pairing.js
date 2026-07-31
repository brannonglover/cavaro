const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ALLOWED_DRINK_TYPES = new Set([
  'cocktail',
  'whiskey',
  'bourbon',
  'rum',
  'wine',
  'beer',
  'coffee',
  'tea',
  'spirit',
  'other',
]);

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizePairing(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const drinkTypeRaw = typeof raw.drinkType === 'string'
    ? raw.drinkType.trim().toLowerCase()
    : 'other';

  return {
    name,
    description: typeof raw.description === 'string'
      ? raw.description.trim()
      : '',
    strengthMatch: clamp(raw.strengthMatch, 1, 5, 3),
    flavorHarmony: clamp(raw.flavorHarmony, 1, 5, 3),
    experienceScore: clamp(raw.experienceScore, 0, 100, 80),
    details: typeof raw.details === 'string' ? raw.details.trim() : '',
    drinkType: ALLOWED_DRINK_TYPES.has(drinkTypeRaw) ? drinkTypeRaw : 'other',
  };
}

/**
 * POST /api/pairing
 * Body: { cigar: string }
 * Headers: Authorization: Bearer <token> (required when Supabase configured - premium tier only)
 * Proxies to OpenAI API for structured drink pairing suggestions.
 */
router.post('/', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OpenAI API key not configured. Add OPENAI_API_KEY to server/.env',
    });
  }

  // When Supabase is configured, require premium tier
  if (supabase) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      const { rows } = await pool.query(
        'SELECT tier FROM user_profiles WHERE id = $1',
        [user.id]
      );
      if (rows[0]?.tier !== 'premium') {
        return res.status(403).json({ error: 'Premium subscription required for drink pairing' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  const cigar = (req.body?.cigar || '').trim();
  if (!cigar) {
    return res.status(400).json({ error: 'Please enter a cigar name.' });
  }

  const systemPrompt = `You are a cigar and beverage pairing expert. Given a cigar name, suggest 2-3 drink pairings that complement it well.

Respond ONLY with valid JSON in this exact shape:
{
  "pairings": [
    {
      "name": "Drink name",
      "description": "One short sentence on why it pairs well.",
      "strengthMatch": 1-5,
      "flavorHarmony": 1-5,
      "experienceScore": 0-100,
      "details": "Longer rationale with serving notes.",
      "drinkType": "cocktail|whiskey|bourbon|rum|wine|beer|coffee|tea|spirit|other"
    }
  ]
}

Keep descriptions concise for a mobile app. Scores should reflect fit with the cigar.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `What drinks pair well with this cigar: ${cigar}?` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || data.error || 'OpenAI request failed';
      return res.status(response.status).json({ error: errMsg });
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(502).json({ error: 'No response received.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Invalid pairing response format.' });
    }

    const pairings = (Array.isArray(parsed?.pairings) ? parsed.pairings : [])
      .map(normalizePairing)
      .filter(Boolean)
      .slice(0, 3);

    if (pairings.length === 0) {
      return res.status(502).json({ error: 'No pairing suggestions returned.' });
    }

    return res.json({ pairings });
  } catch (err) {
    console.error('Pairing API error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to get pairing suggestions. Check your connection.',
    });
  }
});

module.exports = router;
