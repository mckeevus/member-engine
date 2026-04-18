const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const ALLOWED_ORIGINS = [
    'https://www.memberengine.co',
    'https://memberengine.co',
    'https://member-engine-modules.vercel.app',
    'https://mckeevus.github.io',
  ];
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    email,
    score_activation,
    score_habit,
    score_connection,
    score_communication,
    score_detection,
    score_ascension,
    score_total,
    primary_leak,
    severity,
    referrer,
    user_agent,
  } = req.body;

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    await supabase.from('free_diagnostic_results').insert({
      email:               email               ?? null,
      score_activation:    score_activation    ?? null,
      score_habit:         score_habit         ?? null,
      score_connection:    score_connection    ?? null,
      score_communication: score_communication ?? null,
      score_detection:     score_detection     ?? null,
      score_ascension:     score_ascension     ?? null,
      score_total:         score_total         ?? null,
      primary_leak:        primary_leak        ?? null,
      severity:            severity            ?? null,
      referrer:            referrer            ?? null,
      user_agent:          user_agent          ?? null,
    });
  } catch (err) {
    // Fail silently — don't block the user from seeing their results
    console.error('free_diagnostic insert error:', err.message);
  }

  return res.status(200).json({ ok: true });
};
