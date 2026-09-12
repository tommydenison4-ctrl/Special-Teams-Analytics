const HANDLERS = {
  storage: () => import('../lib/sela-storage.js'),
  roster: () => import('../lib/sela-roster.js'),
  sync: () => import('../lib/sela-sync.js'),
  enrich: () => import('../lib/sela-enrich.js')
};

export default async function handler(req, res) {
  const route = String(req.query?.route || '').toLowerCase();
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
