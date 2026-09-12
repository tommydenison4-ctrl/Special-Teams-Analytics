const HANDLERS = {
  storage: () => import('../lib/sela-storage.js'),
  roster: () => import('../lib/sela-roster.js'),
  sync: () => import('../lib/sela-sync.js'),
  enrich: () => import('../lib/sela-enrich.js')
};

export default async function handler(req, res) {
  const route = String(req.query?.route || '').toLowerCase();

  // Fixed one-time Week 3 roster bootstrap. No caller-controlled URL,
  // team identity or Supabase destination is accepted here.
  if (route === 'bootstrap') {
    try {
      const mod = await import('../lib/sela-sync.js');
      req.method = 'POST';
      req.body = {
        adminKey: process.env.SPECIAL_TEAMS_ADMIN_KEY || '',
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
      req.body = { publicSelaRefresh: true, batchSize: 8 };
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
