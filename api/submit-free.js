const { createClient } = require('@supabase/supabase-js');

const SYSTEME_TAG_IDS = {
  'diagnostic-complete': 1967671,
  'weak-activation':     1967672,
  'weak-habit':          1967673,
  'weak-connection':     1967674,
  'weak-communication':  1967675,
  'weak-detection':      1967676,
  'weak-ascension':      1967677,
};

async function applyTag(contactId, tagId, BASE, KEY) {
  await fetch(`${BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ tagId }),
  });
}

async function syncToSysteme(email, primaryLeak, severity, scoreTotal) {
  if (!email || !process.env.SYSTEME_API_KEY) return;

  const BASE = 'https://api.systeme.io/api';
  const KEY  = process.env.SYSTEME_API_KEY;

  const fields = [
    { slug: 'primary_leak', value: primaryLeak ?? '' },
    { slug: 'score_total',  value: String(scoreTotal ?? '') },
  ].filter(f => f.value !== '');

  const weakTag = primaryLeak ? SYSTEME_TAG_IDS[`weak-${primaryLeak}`] : null;

  // Try to create contact
  const createRes = await fetch(`${BASE}/contacts`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ email, fields }),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    if (created?.id) {
      await applyTag(created.id, SYSTEME_TAG_IDS['diagnostic-complete'], BASE, KEY);
      if (weakTag) await applyTag(created.id, weakTag, BASE, KEY);
    }
    return;
  }

  const createData = await createRes.json();
  const alreadyExists = createData.violations?.some(v => v.message?.includes('already used'));
  if (!alreadyExists) return;

  // Contact exists — find it, patch fields, apply tags
  const searchRes = await fetch(`${BASE}/contacts?email=${encodeURIComponent(email)}`, {
    headers: { 'X-API-Key': KEY, 'accept': 'application/json' },
  });
  const searchData = await searchRes.json();
  const contact = searchData.items?.[0];
  if (!contact) return;

  await fetch(`${BASE}/contacts/${contact.id}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/merge-patch+json', 'accept': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  await applyTag(contact.id, SYSTEME_TAG_IDS['diagnostic-complete'], BASE, KEY);
  if (weakTag) await applyTag(contact.id, weakTag, BASE, KEY);
}

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

  // Supabase insert
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
    console.error('free_diagnostic insert error:', err.message);
  }

  // Systeme.io sync
  try {
    await syncToSysteme(email, primary_leak, severity, score_total);
  } catch (err) {
    console.error('systeme sync error:', err.message);
  }

  return res.status(200).json({ ok: true });
};
