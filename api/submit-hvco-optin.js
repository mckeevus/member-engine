const SYSTEME_TAG_IDS = {
  'diagnostic-optin': 1967652,
  'hvco-optin': 1984124,
};

async function applyTag(contactId, tagId, BASE, KEY) {
  await fetch(`${BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ tagId }),
  });
}

async function syncHvcoOptinToSysteme(email, firstName) {
  if (!email || !process.env.SYSTEME_API_KEY) return;

  const BASE = 'https://api.systeme.io/api';
  const KEY  = process.env.SYSTEME_API_KEY;

  const contactPayload = { email };
  if (firstName) contactPayload.fields = [{ slug: 'first_name', value: firstName }];

  // Try to create contact
  const createRes = await fetch(`${BASE}/contacts`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(contactPayload),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    if (created?.id) await applyTag(created.id, SYSTEME_TAG_IDS['hvco-optin'], BASE, KEY);
    return;
  }

  const createData = await createRes.json();
  const alreadyExists = createData.violations?.some(v => v.message?.includes('already used'));
  if (!alreadyExists) return;

  // Contact exists — look up and apply tag
  const searchRes = await fetch(`${BASE}/contacts?email=${encodeURIComponent(email)}`, {
    headers: { 'X-API-Key': KEY, 'accept': 'application/json' },
  });
  const searchData = await searchRes.json();
  const contact = searchData.items?.[0];
  if (!contact) return;

  // Update first_name if provided and not already set
  if (firstName) {
    await fetch(`${BASE}/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ fields: [{ slug: 'first_name', value: firstName }] }),
    });
  }

  await applyTag(contact.id, SYSTEME_TAG_IDS['hvco-optin'], BASE, KEY);
}

module.exports = async (req, res) => {
  const ALLOWED_ORIGINS = [
    'https://www.memberengine.co',
    'https://memberengine.co',
    'https://member-engine.vercel.app',
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

  const { email, first_name } = req.body;

  try {
    await syncHvcoOptinToSysteme(email, first_name);
  } catch (err) {
    console.error('hvco optin systeme sync error:', err.message);
  }

  return res.status(200).json({ ok: true });
};
