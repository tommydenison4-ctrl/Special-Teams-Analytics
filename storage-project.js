// V13.4 shared-write project endpoint.
// Anyone who can access the deployed app can read/write Current/project.json.
// SUPABASE_SERVICE_ROLE_KEY stays server-side in Vercel and is never exposed to the browser.

const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Current/project.json';

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value.replace(/\/$/, '');
}

function storageUrl(base) {
  return `${base}/storage/v1/object/${encodeURIComponent(BUCKET)}/${OBJECT_PATH.split('/').map(encodeURIComponent).join('/')}`;
}

function headers(serviceKey, extra={}) {
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
    const url = storageUrl(base);

    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (req.method === 'GET') {
      const r = await fetch(`${url}?v=${Date.now()}`, {
        method: 'GET',
        headers: headers(key),
        cache: 'no-store',
      });
      if (r.status === 404) return res.status(404).json({ error: 'project.json not found' });
      const body = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: body || 'Could not load project.json' });
      let data;
      try { data = JSON.parse(body); }
      catch { return res.status(500).json({ error: 'project.json is not valid JSON' }); }
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const incoming = req.body?.data ?? req.body;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return res.status(400).json({ error: 'Missing project data' });
      }
      const payload = {
        ...incoming,
        updatedAt: incoming.updatedAt || new Date().toISOString(),
      };
      const r = await fetch(url, {
        method: 'POST',
        headers: headers(key, {
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        }),
        body: JSON.stringify(payload),
      });
      const body = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: body || 'Could not save project.json' });
      return res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('storage-project error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
