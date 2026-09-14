const HANDLERS = {
  storage: () => import('../lib/sela-storage.js'),
  roster: () => import('../lib/sela-roster.js'),
  sync: () => import('../lib/sela-sync.js'),
  enrich: () => import('../lib/sela-enrich.js')
};

const SELA_BUCKET = 'Special Teams';
const SELA_FIXED_OBJECTS = {
  depth: 'Opponents/SoutheasternLA/depth-chart.json'
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function serveFixedObject(route, res) {
  const objectPath = SELA_FIXED_OBJECTS[route];
  if (!objectPath) return false;

  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    sendJson(res, 500, { ok: false, error: 'Missing Supabase server credentials.' });
    return true;
  }

  const bucket = encodeURIComponent(SELA_BUCKET);
  const path = objectPath.split('/').map(encodeURIComponent).join('/');
  const url = `${base}/storage/v1/object/${bucket}/${path}`;

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store'
    });
    if (!response.ok) {
      const detail = await response.text();
      sendJson(res, response.status, {
        ok: false,
        error: `Southeastern Louisiana ${route} read failed (${response.status})${detail ? ': ' + detail : ''}`
      });
      return true;
    }
    const data = await response.json();
    sendJson(res, 200, data);
    return true;
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || `Southeastern Louisiana ${route} read failed.` });
    return true;
  }
}

export default async function handler(req, res) {
  const route = String(req.query?.route || '').toLowerCase();

  if (await serveFixedObject(route, res)) return;

  // Fixed Week 3 roster bootstrap. The caller cannot choose a URL, team identity,
  // or Supabase destination; only the official Southeastern Louisiana pages are used.
  if (route === 'bootstrap') {
    try {
      const mod = await import('../lib/sela-sync.js');
      req.method = 'POST';
      req.__internalSelaBootstrap = true;
      req.body = {
        url: 'https://lionsports.net/sports/football/roster',
        secondaryUrl: 'https://lionsports.net/sports/football/roster/2025',
        teamName: 'Southeastern Louisiana',
        nickname: 'Lions',
        teamCode: 'LASE'
      };
      return await mod.default(req, res);
    } catch (error) {
      console.error('SELA roster bootstrap failed', error);
      if (!res.headersSent) res.status(500).json({ ok: false, error: error?.message || String(error) });
      return;
    }
  }

  // Fixed enrichment step. It can only update the Southeastern roster.json and
  // only follows official lionsports.net player profile URLs already in that roster.
  if (route === 'enrich-step') {
    try {
      const mod = await import('../lib/sela-enrich.js');
      req.method = 'POST';
      req.__internalSelaEnrich = true;
      req.body = { batchSize: 8 };
      return await mod.default(req, res);
    } catch (error) {
      console.error('SELA enrichment step failed', error);
      if (!res.headersSent) res.status(500).json({ ok: false, error: error?.message || String(error) });
      return;
    }
  }

  const load = HANDLERS[route];
  if (!load) {
    res.status(404).json({ ok: false, error: 'Unknown Southeastern Louisiana API route' });
    return;
  }
  try {
    const mod = await load();
    return await mod.default(req, res);
  } catch (error) {
    console.error('SELA API route failed', route, error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  }
}
