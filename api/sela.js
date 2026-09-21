const HANDLERS = {
  storage: () => import('../lib/sela-storage.js'),
  roster: () => import('../lib/sela-roster.js'),
  sync: () => import('../lib/sela-sync.js'),
  enrich: () => import('../lib/sela-enrich.js'),
  'fau-storage': () => import('../lib/fau-storage.js'),
  'fau-roster': () => import('../lib/fau-roster.js'),
  'fau-sync': () => import('../lib/fau-sync.js'),
  'fau-enrich': () => import('../lib/fau-enrich.js')
};

const SELA_PUBLISHED_DEPTH = {
  team: 'Southeastern Louisiana',
  season: 2026,
  week: 3,
  source: '2026 Southeastern Louisiana Football Game Notes',
  updated: '2026-09-13',
  specialTeams: {
    PT: [['46', 'Jack Hunter', 'Sr.'], ['28', 'Aiden Parker', 'So.']],
    PK: [['29', 'Drew Talley', 'So.'], ['27', 'Owen Wiley', 'Jr.']],
    KO: [['27', 'Owen Wiley', 'Jr.'], ['29', 'Drew Talley', 'So.']],
    LS: [['41', 'Shawn Puissegur', 'So.'], ['13', 'Conner Nelson', 'So.']],
    H: [['46', 'Jack Hunter', 'Sr.']],
    KR: [['2', 'Kyree Paul', 'So.'], ['4', 'Tristan Goodly', 'Sr.']],
    PR: [['9', 'Dkhai Joseph', 'Jr.'], ['82', 'Desmen Jefferson', 'Fr.'], ['19', 'Blake Smith', 'Fr.']]
  }
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const route = String(req.query?.route || '').toLowerCase();

  if (route === 'depth') {
    return sendJson(res, 200, SELA_PUBLISHED_DEPTH);
  }

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

  if (route === 'fau-package') {
    try {
      const mod = await import('../lib/fau-package.js');
      req.method = 'POST';
      req.__internalFauPackage = true;
      req.body = {};
      return await mod.default(req, res);
    } catch (error) {
      console.error('FAU package bootstrap failed', error);
      if (!res.headersSent) res.status(500).json({ ok: false, error: error?.message || String(error) });
      return;
    }
  }

  if (route === 'fau-bootstrap') {
    try {
      const mod = await import('../lib/fau-sync.js');
      req.method = 'POST';
      req.__internalFauBootstrap = true;
      req.body = {
        url: 'https://fausports.com/sports/football/roster',
        secondaryUrl: 'https://fausports.com/sports/football/roster/2025',
        teamName: 'Florida Atlantic',
        nickname: 'Owls',
        teamCode: 'FLAT'
      };
      return await mod.default(req, res);
    } catch (error) {
      console.error('FAU roster bootstrap failed', error);
      if (!res.headersSent) res.status(500).json({ ok: false, error: error?.message || String(error) });
      return;
    }
  }

  if (route === 'fau-enrich-step') {
    try {
      const mod = await import('../lib/fau-enrich.js');
      req.method = 'POST';
      req.__internalFauEnrich = true;
      req.body = { batchSize: 8 };
      return await mod.default(req, res);
    } catch (error) {
      console.error('FAU roster enrichment failed', error);
      if (!res.headersSent) res.status(500).json({ ok: false, error: error?.message || String(error) });
      return;
    }
  }

  const load = HANDLERS[route];
  if (!load) {
    res.status(404).json({ ok: false, error: 'Unknown special teams API route' });
    return;
  }
  try {
    const mod = await load();
    return await mod.default(req, res);
  } catch (error) {
    console.error('Special teams API route failed', route, error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  }
}
