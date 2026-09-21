const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Opponents/FloridaAtlantic/roster.json';
const BIO_REFRESH_VERSION = 'sela-assets-2026-09-13-v5';
const OFFICIAL_HOST = 'fausports.com';

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
  return { url, serviceKey, adminKey };
}

function objectUrl(base) {
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/${bucket}/${path}`;
}

async function loadRoster(base, serviceKey) {
  const response = await fetch(`${objectUrl(base)}?v=${Date.now()}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
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

function decodeHtml(value='') {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value='') {
  return decodeHtml(String(value).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value='') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attr(tag, name) {
  const re = new RegExp(`${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  return decodeHtml(tag.match(re)?.[2] || '').trim();
}

function validateProfile(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== OFFICIAL_HOST || !url.pathname.startsWith('/sports/football/roster/')) return null;
    return url;
  } catch {
    return null;
  }
}

function highResImage(raw, pageUrl) {
  if (!raw) return '';
  try {
    const url = new URL(raw, pageUrl);
    const host = url.hostname.toLowerCase();
    const allowed = host === OFFICIAL_HOST || host.endsWith('.fausports.com') || host === 'images.sidearmdev.com' || host.endsWith('.sidearmdev.com') || host === 'images.sidearmsports.com' || host.endsWith('.sidearmsports.com') || host.endsWith('.cloudfront.net');
    if (!allowed || url.protocol !== 'https:') return '';
    url.searchParams.delete('width');
    return url.href;
  } catch {
    return '';
  }
}

async function fetchProfile(player) {
  const profile = validateProfile(player.profile);
  if (!profile) return { bio: '', image: '' };
  const response = await fetch(profile.href, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Profile ${response.status}`);
  const html = await response.text();

  const bioMatch = html.match(/<div\b[^>]*class=["'][^"']*sidearm-roster-player-bio-container[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const bio = cleanText(bioMatch?.[1] || '').slice(0, 12000);

  const target = String(player.name || '').toLowerCase().replace(/[“”"'’.,()]/g, '').replace(/\s+/g, ' ').trim();
  let image = '';
  let bestScore = -1;
  const tags = html.match(/<(?:img|source|meta)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const alt = cleanText(attr(tag, 'alt')).toLowerCase().replace(/[“”"'’.,()]/g, '').replace(/\s+/g, ' ').trim();
    let raw = attr(tag, 'content') || attr(tag, 'data-src') || attr(tag, 'data-original') || attr(tag, 'data-lazy-src') || attr(tag, 'data-srcset') || attr(tag, 'src') || attr(tag, 'srcset');
    if (raw && raw.includes(',')) { const parts = raw.split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean); raw = parts[parts.length - 1] || raw; }
    const candidate = highResImage(raw, profile.href);
    if (!candidate || /logo|icon|sprite|placeholder|advert|banner|sponsor/i.test(candidate)) continue;
    let score = 0;
    if (target && alt.includes(target)) score += 150;
    if (/property=[\"']og:image/i.test(tag)) score += 120;
    if (/\/images\/20\d{2}\//i.test(candidate)) score += 60;
    if (/_web_|web_|football|roster/i.test(candidate)) score += 30;
    if (score > bestScore) { bestScore = score; image = candidate; }
  }

  return { bio, image };
}

async function enrichOne(player) {
  if (!player.profile) return { ...player, photoRefreshVersion: BIO_REFRESH_VERSION, bioRefreshVersion: BIO_REFRESH_VERSION };
  try {
    const detail = await fetchProfile(player);
    return {
      ...player,
      image: detail.image || player.image || '',
      bio: detail.bio || player.bio || '',
      imageVerifiedAt: new Date().toISOString(),
      bioVerifiedAt: new Date().toISOString(),
      photoRefreshVersion: BIO_REFRESH_VERSION,
      bioRefreshVersion: BIO_REFRESH_VERSION
    };
  } catch (error) {
    console.error('FAU profile enrichment failed:', player.profile, error?.message || error);
    return {
      ...player,
      imageVerifiedAt: new Date().toISOString(),
      bioVerifiedAt: new Date().toISOString(),
      photoRefreshVersion: BIO_REFRESH_VERSION,
      bioRefreshVersion: BIO_REFRESH_VERSION,
      bioRefreshError: error?.message || String(error)
    };
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'southeastern-roster-enrichment', version: BIO_REFRESH_VERSION });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const body = await readJsonBody(req);
    const { url, serviceKey, adminKey } = environment();
    const internal = req.__internalFauEnrich === true;
    if (!internal) {
      if (!adminKey) throw new Error('SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.');
      if (String(body.adminKey || '') !== adminKey) return sendJson(res, 403, { error: 'Incorrect admin key.' });
    }

    const batchSize = Math.max(1, Math.min(Number(body.batchSize) || 8, 10));
    const { meta, players } = await loadRoster(url, serviceKey);
    if (!players.length) return sendJson(res, 404, { error: 'roster.json contains no players.' });

    const pendingIndexes = [];
    for (let i = 0; i < players.length && pendingIndexes.length < batchSize; i += 1) {
      const p = players[i];
      if (p.profile && p.bioRefreshVersion !== BIO_REFRESH_VERSION) pendingIndexes.push(i);
    }

    if (!pendingIndexes.length) {
      return sendJson(res, 200, {
        ok: true,
        done: true,
        processed: 0,
        total: players.length,
        completed: players.filter(p => !p.profile || p.bioRefreshVersion === BIO_REFRESH_VERSION).length,
        photos: players.filter(p => p.image).length,
        bios: players.filter(p => p.bio).length,
        remaining: 0
      });
    }

    const enriched = await Promise.all(pendingIndexes.map(i => enrichOne(players[i])));
    pendingIndexes.forEach((index, j) => { players[index] = enriched[j]; });
    await saveRoster(url, serviceKey, meta, players);

    const remaining = players.filter(p => p.profile && p.bioRefreshVersion !== BIO_REFRESH_VERSION).length;
    return sendJson(res, 200, {
      ok: true,
      done: remaining === 0,
      processed: pendingIndexes.length,
      total: players.length,
      completed: players.filter(p => !p.profile || p.bioRefreshVersion === BIO_REFRESH_VERSION).length,
      photos: players.filter(p => p.image).length,
      bios: players.filter(p => p.bio).length,
      remaining
    });
  } catch (error) {
    console.error('Southeastern roster enrichment error:', error);
    return sendJson(res, 500, { error: error?.message || 'Roster enrichment failed.' });
  }
}
