import crypto from 'node:crypto';

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
    if (raw.length > 4_000_000) throw new Error('Request is too large for Vercel.');
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

function environment() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  return { url, key };
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function newId() {
  return crypto.randomBytes(9).toString('base64url');
}

function newSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function supabaseError(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || text;
  } catch {
    return text;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'special-teams-project-storage',
      version: '7.4',
      method: 'POST'
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const { url, key } = environment();
    const body = await readJsonBody(req);
    const action = String(body.action || 'save');

    if (action === 'load') {
      const projectId = String(body.projectId || '').trim();
      if (!projectId) return sendJson(res, 400, { error: 'Missing project ID.' });

      const response = await fetch(
        `${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(projectId)}&select=id,data,updated_at`,
        { headers: supabaseHeaders(key) }
      );

      if (!response.ok) {
        throw new Error(await supabaseError(response, 'Database read failed.'));
      }

      const records = await response.json();
      if (!records.length) return sendJson(res, 404, { error: 'Project not found.' });

      return sendJson(res, 200, {
        projectId: records[0].id,
        data: records[0].data,
        updatedAt: records[0].updated_at
      });
    }

    const data = body.data;
    if (!data || typeof data !== 'object') {
      return sendJson(res, 400, { error: 'Missing project data.' });
    }

    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > 3_800_000) {
      return sendJson(res, 413, {
        error: 'Project is too large for one Vercel request. Reduce the loaded CSV or use database file storage.'
      });
    }

    let projectId = String(body.projectId || '').trim();
    let editKey = String(body.editKey || '').trim();

    if (!projectId) {
      projectId = newId();
      editKey = newSecret();

      const response = await fetch(`${url}/rest/v1/special_teams_projects`, {
        method: 'POST',
        headers: supabaseHeaders(key, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          id: projectId,
          edit_key_hash: hash(editKey),
          data
        })
      });

      if (!response.ok) {
        throw new Error(await supabaseError(response, 'Database insert failed.'));
      }

      return sendJson(res, 200, { projectId, editKey, created: true });
    }

    if (!editKey) {
      return sendJson(res, 403, {
        error: 'This browser does not have the edit key for this project.'
      });
    }

    const lookup = await fetch(
      `${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(projectId)}&select=edit_key_hash`,
      { headers: supabaseHeaders(key) }
    );

    if (!lookup.ok) {
      throw new Error(await supabaseError(lookup, 'Database lookup failed.'));
    }

    const records = await lookup.json();
    if (!records.length) return sendJson(res, 404, { error: 'Project not found.' });
    if (records[0].edit_key_hash !== hash(editKey)) {
      return sendJson(res, 403, { error: 'Invalid edit key.' });
    }

    const response = await fetch(
      `${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(key, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ data, updated_at: new Date().toISOString() })
      }
    );

    if (!response.ok) {
      throw new Error(await supabaseError(response, 'Database update failed.'));
    }

    return sendJson(res, 200, { projectId, updated: true });
  } catch (error) {
    console.error('Project API error:', error);
    return sendJson(res, 500, { error: error?.message || 'Server error.' });
  }
}
