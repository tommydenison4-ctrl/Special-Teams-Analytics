// V13.6 shared project persistence using a Supabase DATABASE table.
// This mirrors the cross-device persistence pattern used by the coaching-notes apps.
// Anyone with the deployed app URL can read/write the single shared project row.
// SUPABASE_SERVICE_ROLE_KEY remains server-side in Vercel.

const TABLE = 'special_teams_shared_project';
const ROW_ID = 'current';

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value.replace(/\/$/, '');
}

function headers(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

export default async function handler(req, res) {
  try {
    const base = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const rest = `${base}/rest/v1/${TABLE}`;

    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (req.method === 'GET') {
      const url = `${rest}?id=eq.${encodeURIComponent(ROW_ID)}&select=data,updated_at`;
      const r = await fetch(url, {
        method: 'GET',
        headers: headers(key, { Accept: 'application/json' }),
        cache: 'no-store',
      });
      const body = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: body || 'Could not load shared project' });
      let rows = [];
      try { rows = JSON.parse(body); } catch { return res.status(500).json({ error: 'Invalid database response' }); }
      if (!rows.length) return res.status(404).json({ error: 'Shared project row not found' });
      const row = rows[0] || {};
      const data = row.data && typeof row.data === 'object' ? row.data : {};
      if (!data.updatedAt && row.updated_at) data.updatedAt = row.updated_at;
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const incoming = req.body?.data ?? req.body;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return res.status(400).json({ error: 'Missing project data' });
      }

      const updatedAt = new Date().toISOString();
      const payload = {
        id: ROW_ID,
        data: { ...incoming, updatedAt },
        updated_at: updatedAt,
      };

      const r = await fetch(`${rest}?on_conflict=id`, {
        method: 'POST',
        headers: headers(key, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(payload),
      });
      const body = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: body || 'Could not save shared project' });
      return res.status(200).json({ ok: true, updatedAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('storage-project error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
