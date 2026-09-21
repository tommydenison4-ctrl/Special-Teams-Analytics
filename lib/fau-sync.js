const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Opponents/FloridaAtlantic/roster.json';
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminKey = process.env.SPECIAL_TEAMS_ADMIN_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return { url, key, adminKey };
}

function validateRosterUrl(raw) {
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('Enter a valid Florida Atlantic roster URL.'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== OFFICIAL_HOST || !url.pathname.startsWith('/sports/football/roster')) {
    throw new Error('Only the official Florida Atlantic football roster is allowed.');
  }
  return url;
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
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(tag, key) {
  const m = String(tag || '').match(new RegExp(`${key}=["']([^"']+)["']`, 'i'));
  return decodeHtml(m?.[1] || '').trim();
}

function absoluteOfficial(value, pageUrl) {
  if (!value) return '';
  try {
    const url = new URL(value, pageUrl);
    if (url.hostname.toLowerCase() !== OFFICIAL_HOST) return '';
    return url.href;
  } catch {
    return '';
  }
}

function highResImage(value, pageUrl) {
  if (!value) return '';
  try {
    const url = new URL(value, pageUrl);
    const host = url.hostname.toLowerCase();
    const allowed = host === OFFICIAL_HOST || host.endsWith('.fausports.com') || host === 'images.sidearmdev.com' || host.endsWith('.sidearmdev.com') || host === 'images.sidearmsports.com' || host.endsWith('.sidearmsports.com') || host.endsWith('.cloudfront.net');
    if (!allowed || url.protocol !== 'https:') return '';
    url.searchParams.delete('width');
    url.searchParams.delete('height');
    return url.href;
  } catch {
    return '';
  }
}

function field(block, className) {
  const safe = String(className).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<[^>]*class=["'][^"']*${safe}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  return cleanText(String(block || '').match(re)?.[1] || '');
}

function imageFrom(block, pageUrl) {
  const tags = [...String(block || '').matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  let best = '';
  for (const tag of tags) {
    const low = tag.toLowerCase();
    if (!/sidearm-roster-player-image|roster-player-image|headshot|portrait/.test(low)) continue;
    const values = ['data-src','data-original','data-lazy-src','src'].map(k => attr(tag, k)).filter(Boolean);
    const srcset = attr(tag, 'srcset');
    if (srcset) srcset.split(',').forEach(x => values.push(x.trim().split(/\s+/)[0]));
    for (const value of values) {
      const candidate = highResImage(value, pageUrl);
      if (candidate && !/logo|placeholder|default|sponsor|icon|story|news|signing|social|graphic/i.test(candidate)) {
        best = candidate;
        break;
      }
    }
    if (best) break;
  }
  if (!best) {
    for (const tag of tags) {
      const alt = cleanText(attr(tag, 'alt'));
      if (!alt) continue;
      const values = ['data-src','data-original','data-lazy-src','src'].map(k => attr(tag, k)).filter(Boolean);
      for (const value of values) {
        const candidate = highResImage(value, pageUrl);
        if (candidate && !/logo|placeholder|default|sponsor|icon|story|news|signing|social|graphic/i.test(candidate)) {
          best = candidate;
          break;
        }
      }
      if (best) break;
    }
  }
  return best;
}

async function fetchHtml(url) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set('view', '2');
  requestUrl.searchParams.set('v', String(Date.now()));
  const response = await fetch(requestUrl.href, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Official roster request failed (${response.status}).`);
  return { html: await response.text(), pageUrl: requestUrl.href };
}

function parseRosterHtml(html, pageUrl) {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const titleSeason = Number(title.match(/(20\d{2})\s+Football Roster/i)?.[1] || 0) || null;
  const pathSeason = Number(new URL(pageUrl).pathname.match(/\/roster\/(20\d{2})\/?$/)?.[1] || 0) || null;
  const rosterSeason = pathSeason || titleSeason || null;
  const players = [];
  const seen = new Set();
  const cardRe = /<li\b[^>]*class=["'][^"']*sidearm-roster-player[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = cardRe.exec(html))) {
    const block = match[1];
    const links = [...block.matchAll(/<a\b[^>]+href=["']([^"']*\/sports\/football\/roster\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({ href: m[1], label: cleanText(m[2]) }));
    const link = links.find(x => x.label && !/^jersey number/i.test(x.label) && !/full bio/i.test(x.label));
    if (!link) continue;

    const name = link.label;
    const profile = absoluteOfficial(link.href, pageUrl);
    if (!name || !profile) continue;

    const number = (field(block, 'sidearm-roster-player-jersey-number').match(/\d{1,3}/) || [])[0] || '';
    const position = field(block, 'sidearm-roster-player-position').replace(/^Position\s*/i, '').trim();
    const playerClass = field(block, 'sidearm-roster-player-academic-year').replace(/^Academic Year\s*/i, '').trim();
    const hometown = field(block, 'sidearm-roster-player-hometown').replace(/^Hometown\s*/i, '').trim();
    const height = field(block, 'sidearm-roster-player-height').replace(/^Height\s*/i, '').trim();
    const weight = field(block, 'sidearm-roster-player-weight').replace(/^Weight\s*/i, '').replace(/\s*lbs?\.?$/i, '').trim();
    const previousSchool = field(block, 'sidearm-roster-player-previous-school').replace(/^Previous School\s*/i, '').trim();
    const image = imageFrom(block, pageUrl);

    const key = name.toLowerCase().replace(/[“”"'’.,()]/g, '').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    players.push({
      number,
      name,
      position,
      class: playerClass,
      height,
      weight,
      hometown,
      previousSchool,
      image,
      profile,
      bio: '',
      rosterSeason
    });
  }

  return { source: pageUrl, pageTitle: title, players };
}

async function scrapeRoster(rawUrl) {
  const url = validateRosterUrl(rawUrl);
  const fetched = await fetchHtml(url.href);
  const result = parseRosterHtml(fetched.html, fetched.pageUrl);
  if (result.players.length < 20) {
    throw new Error(`Official roster parsed only ${result.players.length} players.`);
  }
  return result;
}

function nameKey(value='') {
  return String(value).toLowerCase().replace(/[“”"'’.,()]/g, '').replace(/\s+/g, ' ').trim();
}

function mergeRosters(current, historical) {
  const merged = new Map();
  const absorb = (player, preferCurrent=false) => {
    const key = nameKey(player.name);
    if (!key) return;
    const season = Number(player.rosterSeason || 0) || null;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...player,
        rosterSeasons: season ? [season] : [],
        historicalNumbers: season && player.number ? { [season]: String(player.number) } : {}
      });
      return;
    }
    const rosterSeasons = [...new Set([...(existing.rosterSeasons || []), ...(season ? [season] : [])])].sort((a,b) => b-a);
    const historicalNumbers = { ...(existing.historicalNumbers || {}) };
    if (season && player.number) historicalNumbers[season] = String(player.number);
    merged.set(key, preferCurrent
      ? { ...existing, ...player, rosterSeasons, historicalNumbers }
      : { ...player, ...existing, rosterSeasons, historicalNumbers });
  };
  current.players.forEach(player => absorb(player, true));
  historical?.players?.forEach(player => absorb(player, false));
  return [...merged.values()];
}

async function saveRosterToSupabase(players, meta) {
  const { url, key } = environment();
  const bucket = encodeURIComponent(BUCKET);
  const path = OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: meta.source || '',
    teamName: meta.teamName || '',
    nickname: meta.nickname || '',
    teamCode: meta.teamCode || '',
    count: players.length,
    players
  });
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json; charset=utf-8',
      'x-upsert': 'true',
      'cache-control': '3600'
    },
    body: payload
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase roster save failed (${response.status}): ${detail || 'unknown error'}`);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'fau-roster-sync', version: '10.1', savesTo: `${BUCKET}/${OBJECT_PATH}` });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const body = await readJsonBody(req);
    const { adminKey } = environment();
    const internalBootstrap = req.__internalFauBootstrap === true;
    if (!internalBootstrap) {
      if (!adminKey) throw new Error('SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.');
      if (String(body.adminKey || '') !== adminKey) return sendJson(res, 403, { error: 'Incorrect admin key.' });
    }

    const rosterUrl = validateRosterUrl(body.url || 'https://fausports.com/sports/football/roster');
    const historicalUrl = validateRosterUrl(body.secondaryUrl || 'https://fausports.com/sports/football/roster/2025');
    const [current, historical] = await Promise.all([
      scrapeRoster(rosterUrl.href),
      scrapeRoster(historicalUrl.href).catch(() => ({ source: historicalUrl.href, players: [] }))
    ]);
    const players = mergeRosters(current, historical);

    await saveRosterToSupabase(players, {
      source: `${current.source} | ${historical.source}`,
      teamName: body.teamName || 'Florida Atlantic',
      nickname: body.nickname || 'Owls',
      teamCode: body.teamCode || 'FLAT'
    });

    return sendJson(res, 200, {
      ok: true,
      count: players.length,
      currentCount: current.players.length,
      historicalCount: historical.players.length,
      source: current.source,
      historicalSource: historical.source,
      storedAt: `${BUCKET}/${OBJECT_PATH}`
    });
  } catch (error) {
    console.error('Florida Atlantic roster sync error:', error);
    return sendJson(res, 500, { error: error?.message || 'Roster sync failed.' });
  }
}
