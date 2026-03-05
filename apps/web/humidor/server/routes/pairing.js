const express = require('express');
const router = express.Router();

/**
 * POST /api/pairing
 * Body: { cigar: string }
 * Proxies to OpenAI API for drink pairing suggestions.
 * Requires OPENAI_API_KEY in server .env.
 */
router.post('/', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OpenAI API key not configured. Add OPENAI_API_KEY to server/.env',
    });
  }

  const cigar = (req.body?.cigar || '').trim();
  if (!cigar) {
    return res.status(400).json({ error: 'Please enter a cigar name.' });
  }

  const systemPrompt = `You are a cigar and beverage pairing expert. Given a cigar name, suggest 2-4 drink pairings that complement it well. Include brief reasoning for each pairing (why the flavors work together). Keep responses concise and practical, suitable for a mobile app. Format as a short list with bullet points or numbered items.`;

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
        max_tokens: 400,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || data.error || 'OpenAI request failed';
      return res.status(response.status).json({ error: errMsg });
    }

    const content = data.choices?.[0]?.message?.content?.trim() || 'No response received.';
    return res.json({ pairing: content });
  } catch (err) {
    console.error('Pairing API error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to get pairing suggestions. Check your connection.',
    });
  }
});

module.exports = router;
