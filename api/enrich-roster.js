import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Current/roster.json';

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
    if (raw.length > 100_000) throw new Error('Request body is too large.');
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

function environment() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminKey = process.env.SPECIAL_TEAMS_ADMIN_KEY;
  if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  if (!adminKey) throw new Error('SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.');
  return { url, serviceKey, adminKey };
}

function publicObjectUrl(base) {
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

function objectUrl(base) {
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/${bucket}/${path}`;
}

async function loadRoster(base, serviceKey) {
  const response = await fetch(`${objectUrl(base)}?v=${Date.now()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not load roster.json (${response.status}): ${detail || 'unknown error'}`);
  }
  const data = await response.json();
  return {
    meta: Array.isArray(data) ? {} : data,
    players: Array.isArray(data) ? data : (Array.isArray(data.players) ? data.players : [])
  };
}

async function saveRoster(base, serviceKey, meta, players) {
  const payload = JSON.stringify({
    ...meta,
    generatedAt: meta.generatedAt || new Date().toISOString(),
    enrichedAt: new Date().toISOString(),
    count: players.length,
    players
  });

  const response = await fetch(objectUrl(base), {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json; charset=utf-8',
      'x-upsert': 'true',
      'cache-control': '3600'
    },
    body: payload
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase roster update failed (${response.status}): ${detail || 'unknown error'}`);
  }
}

async function launchBrowser() {
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run'
    ],
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: 'shell'
  });
}

async function enrichProfile(page, player) {
  if (!player.profile) return player;

  try {
    await page.goto(player.profile, { waitUntil: 'domcontentloaded', timeout: 18_000 });
    await new Promise(resolve => setTimeout(resolve, 450));

    const detail = await page.evaluate((playerName) => {
      const clean = value => String(value || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
      const normalize = value => clean(value).toLowerCase().replace(/[“”"'’.,()]/g,'').replace(/\s+/g,' ').trim();
      const abs = value => {
        try { return value ? new URL(value, location.href).href : ''; }
        catch { return ''; }
      };

      const target = normalize(playerName);
      const candidates = [];

      document.querySelectorAll('img,source,meta[property="og:image"]').forEach((el) => {
        let raw =
          el.getAttribute('content') ||
          el.getAttribute('data-src') ||
          el.getAttribute('data-original') ||
          el.getAttribute('data-lazy-src') ||
          el.getAttribute('src') ||
          el.getAttribute('srcset') ||
          '';

        if (!raw) return;

        if (raw.includes(',')) {
          const parts = raw.split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
          if (parts.length) raw = parts[parts.length - 1];
        }

        const url = abs(raw);
        if (!url) return;

        const alt = normalize(el.getAttribute('alt') || '');
        const src = url.toLowerCase();

        if (/logo|icon|sprite|placeholder|advert|banner|sponsor/.test(src)) return;

        let score = 0;

        // Strong signals for official player photos.
        if (target && alt.includes(target)) score += 150;
        if (/headshot|headshots|production|_web_|web_/.test(src)) score += 70;
        if (/sidearmdev|cloudfront/.test(src)) score += 30;
        if (/football/.test(alt)) score += 10;

        // Penalize generic social/hero art.
        if (/og-default|default|social|share/.test(src)) score -= 80;

        const w = Number(el.getAttribute('width') || 0);
        const h = Number(el.getAttribute('height') || 0);
        if (w >= 300 || h >= 300) score += 15;

        candidates.push({url, score});
      });

      candidates.sort((a,b) => b.score - a.score);

      // Bio: use the section around the visible "Bio" tab/content.
      let bio = '';
      const selectors = [
        '.sidearm-roster-player-bio',
        '.sidearm-roster-player-bio-text',
        '.sidearm-roster-player-bio-content',
        '[class*="player-bio"]',
        '[class*="roster-bio"]'
      ];

      for (const selector of selectors) {
        const nodes = [...document.querySelectorAll(selector)];
        for (const node of nodes) {
          const value = clean(node.innerText || node.textContent || '');
          if (value && value.length > 80) {
            bio = value;
            break;
          }
        }
        if (bio) break;
      }

      if (!bio) {
        const bodyText = clean(document.body.innerText || '');
        const bioIndex = bodyText.indexOf('Career Notes');
        const fallbackIndex = bodyText.indexOf('Bio');
        const start = bioIndex >= 0 ? bioIndex : fallbackIndex;
        if (start >= 0) {
          let chunk = bodyText.slice(start);
          const stopMarkers = ['Season Career','Related Videos','Related News','©'];
          let stop = chunk.length;
          for (const marker of stopMarkers) {
            const i = chunk.indexOf(marker);
            if (i > 0 && i < stop) stop = i;
          }
          bio = clean(chunk.slice(0, stop));
        }
      }

      return {
        image: candidates[0]?.url || '',
        imageCandidates: candidates.slice(0,5),
        bio: bio.slice(0,12000)
      };
    }, player.name);

    return {
      ...player,
      image: player.image || detail.image || '',
      bio: player.bio || detail.bio || ''
    };
  } catch (error) {
    console.error('Profile enrichment failed:', player.profile, error?.message || error);
    return player;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const body = await readJsonBody(req);
    const { url, serviceKey, adminKey } = environment();

    if (String(body.adminKey || '') !== adminKey) {
      return sendJson(res, 403, { error: 'Incorrect admin key.' });
    }

    const batchSize = Math.max(1, Math.min(Number(body.batchSize) || 8, 10));
    const { meta, players } = await loadRoster(url, serviceKey);

    if (!players.length) return sendJson(res, 404, { error: 'roster.json contains no players.' });

    // Skip players already enriched. Also skip profile-less players so one bad record
    // cannot cause an endless client loop.
    const pendingIndexes = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.profile && (!p.image || !p.bio)) pendingIndexes.push(i);
      if (pendingIndexes.length >= batchSize) break;
    }

    if (!pendingIndexes.length) {
      const photos = players.filter(p => p.image).length;
      const bios = players.filter(p => p.bio).length;
      return sendJson(res, 200, {
        ok: true,
        done: true,
        processed: 0,
        total: players.length,
        completed: players.filter(p => p.image && p.bio).length,
        photos,
        bios
      });
    }

    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });

      await page.setRequestInterception(true);
      page.on('request', request => {
        const type = request.resourceType();
        if (type === 'font' || type === 'media') request.abort();
        else request.continue();
      });

      for (const i of pendingIndexes) {
        players[i] = await enrichProfile(page, players[i]);
      }
    } finally {
      await browser.close();
    }

    await saveRoster(url, serviceKey, meta, players);

    const photos = players.filter(p => p.image).length;
    const bios = players.filter(p => p.bio).length;
    const completed = players.filter(p => p.image && p.bio).length;
    const remaining = players.filter(p => p.profile && (!p.image || !p.bio)).length;

    return sendJson(res, 200, {
      ok: true,
      done: remaining === 0,
      processed: pendingIndexes.length,
      total: players.length,
      completed,
      photos,
      bios,
      remaining
    });
  } catch (error) {
    console.error('Roster enrichment error:', error);
    return sendJson(res, 500, { error: error?.message || 'Roster enrichment failed.' });
  }
}
