const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Current/project.json';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) throw new Error('Request body is too large.');
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

function environment() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminKey = process.env.SPECIAL_TEAMS_ADMIN_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }

  return { url, serviceKey, adminKey };
}

function publicUrl(url) {
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

function objectUrl(url) {
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/${bucket}/${path}`;
}

export default async function handler(req, res) {
  try {
    const { url, serviceKey, adminKey } = environment();

    if (req.method === 'GET') {
      const response = await fetch(`${publicUrl(url)}?v=${Date.now()}`, {
        cache: 'no-store'
      });

      if (response.status === 404) {
        return sendJson(res, 404, { error: 'project.json not found.' });
      }

      if (!response.ok) {
        return sendJson(res, response.status, {
          error: `Supabase project.json returned ${response.status}.`
        });
      }

      return sendJson(res, 200, {
        data: await response.json()
      });
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    const body = await readJsonBody(req);

    if (String(body.action || 'save') !== 'save') {
      return sendJson(res, 400, { error: 'Unsupported action.' });
    }

    if (!adminKey) {
      return sendJson(res, 500, {
        error: 'SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.'
      });
    }

    if (String(body.adminKey || '') !== adminKey) {
      return sendJson(res, 403, { error: 'Incorrect admin key.' });
    }

    const data = body.data;
    if (!data || typeof data !== 'object') {
      return sendJson(res, 400, { error: 'Missing project data.' });
    }

    const response = await fetch(objectUrl(url), {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-upsert': 'true',
        'cache-control': '3600'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Supabase project save failed (${response.status}): ${detail || 'unknown error'}`
      );
    }

    return sendJson(res, 200, {
      ok: true,
      storedAt: `${BUCKET}/${OBJECT_PATH}`,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Storage project API error:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Storage project request failed.'
    });
  }
}
