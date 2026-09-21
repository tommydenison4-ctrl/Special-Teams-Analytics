const BUCKET = 'Special Teams';
const BASE_PATH = 'Opponents/FloridaAtlantic';
const SOURCE_BASE = 'https://raw.githubusercontent.com/tommydenison4-ctrl/Special-Teams-Analytics/main/fau/data';

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return { url, key };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function fetchSource(name) {
  const response = await fetch(`${SOURCE_BASE}/${name}?v=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'user-agent': 'ULM-Special-Teams-FAU-Package/1.0' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Could not fetch ${name} from GitHub (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadObject(name, body) {
  const { url, key } = env();
  const bucket = encodeURIComponent(BUCKET);
  const objectPath = `${BASE_PATH}/${name}`.split('/').map(encodeURIComponent).join('/');
  const contentType = name.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': '3600'
    },
    body
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase upload failed for ${name} (${response.status}): ${detail || 'unknown error'}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  if (req.__internalFauPackage !== true) return sendJson(res, 403, { error: 'Internal route only.' });

  try {
    const names = ['offensive-side.csv', 'defensive-side.csv', 'depth-chart.json'];
    const files = await Promise.all(names.map(async name => [name, await fetchSource(name)]));
    for (const [name, body] of files) await uploadObject(name, body);
    return sendJson(res, 200, {
      ok: true,
      storedAt: `${BUCKET}/${BASE_PATH}`,
      files: names
    });
  } catch (error) {
    console.error('Florida Atlantic package bootstrap error:', error);
    return sendJson(res, 500, { error: error?.message || 'FAU package bootstrap failed.' });
  }
}
