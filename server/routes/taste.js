const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');
const { effectiveTierForUser } = require('../lib/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ALLOWED_STRENGTHS = new Set(['Mild', 'Mild-Medium', 'Medium', 'Medium-Full', 'Full']);

function asStringArray(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!summary) return null;

  const strengthRaw = typeof raw.strength === 'string' ? raw.strength.trim() : '';
  return {
    flavors: asStringArray(raw.flavors),
    strength: ALLOWED_STRENGTHS.has(strengthRaw) ? strengthRaw : '',
    summary,
    details: typeof raw.details === 'string' ? raw.details.trim() : '',
    palateFit: typeof raw.palateFit === 'string' ? raw.palateFit.trim() : '',
    correlates: Boolean(raw.correlates),
  };
}

function compactPalate(palate) {
  if (!palate || typeof palate !== 'object') return null;
  const favoriteFlavors = asStringArray(palate.favoriteFlavors, 6);
  const dislikedFlavors = asStringArray(palate.dislikedFlavors, 6);
  const favoriteWrappers = asStringArray(palate.favoriteWrappers, 4);
  const preferredStrength = typeof palate.preferredStrength === 'string'
    ? palate.preferredStrength.trim()
    : '';
  if (!favoriteFlavors.length && !dislikedFlavors.length && !favoriteWrappers.length && !preferredStrength) {
    return null;
  }
  return { favoriteFlavors, dislikedFlavors, favoriteWrappers, preferredStrength };
}

function compactCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') return null;
  const pick = (key) => (typeof catalog[key] === 'string' ? catalog[key].trim() : '');
  const next = {
    brand: pick('brand'),
    name: pick('name'),
    line: pick('line'),
    wrapper: pick('wrapper'),
    binder: pick('binder'),
    filler: pick('filler'),
    description: pick('description').slice(0, 600),
  };
  return Object.values(next).some(Boolean) ? next : null;
}

/**
 * POST /api/taste/analyze
 * Body: { cigar: string, catalog?: object, palate?: object }
 * Premium only when Supabase is configured.
 */
router.post('/analyze', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OpenAI API key not configured. Add OPENAI_API_KEY to server/.env',
    });
  }

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
      if (effectiveTierForUser(user, rows[0]?.tier) !== 'premium') {
        return res.status(403).json({ error: 'Premium subscription required for tasting notes' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  const cigar = (req.body?.cigar || '').trim();
  if (!cigar) {
    return res.status(400).json({ error: 'Please enter a cigar name.' });
  }

  const catalog = compactCatalog(req.body?.catalog);
  const palate = compactPalate(req.body?.palate);

  const systemPrompt = `You are a cigar tasting expert. Given a cigar, describe its typical flavor profile for a mobile cigar companion app.

Respond ONLY with valid JSON in this exact shape:
{
  "flavors": ["3 to 6 concise flavor notes"],
  "strength": "Mild|Mild-Medium|Medium|Medium-Full|Full",
  "summary": "One short sentence on overall taste.",
  "details": "2-3 sentences on flavor progression and body.",
  "palateFit": "If a palate is provided, 1-2 sentences on whether it likely suits that smoker. Otherwise empty string.",
  "correlates": true
}

Be specific and grounded. If the cigar is obscure, say so briefly rather than inventing a detailed profile. Keep copy concise.`;

  const userParts = [`Cigar: ${cigar}`];
  if (catalog) {
    userParts.push(`Catalog context: ${JSON.stringify(catalog)}`);
  }
  if (palate) {
    userParts.push(`Smoker palate: ${JSON.stringify(palate)}`);
  } else {
    userParts.push('No smoker palate available.');
  }

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
          { role: 'user', content: userParts.join('\n') },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 700,
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
      return res.status(502).json({ error: 'Invalid tasting response format.' });
    }

    const analysis = normalizeAnalysis(parsed);
    if (!analysis) {
      return res.status(502).json({ error: 'No tasting notes returned.' });
    }

    return res.json(analysis);
  } catch (err) {
    console.error('Taste analyze API error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to analyze cigar taste. Check your connection.',
    });
  }
});

module.exports = router;
