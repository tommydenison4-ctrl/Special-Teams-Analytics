const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Opponents/SoutheasternLA/roster.json';
const OFFICIAL_HOST = 'lionsports.net';

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
  catch { throw new Error('Enter a valid Southeastern Louisiana roster URL.'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== OFFICIAL_HOST || !url.pathname.startsWith('/sports/football/roster')) {
    throw new Error('Only the official Southeastern Louisiana football roster is allowed.');
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

function escapeRegExp(value='') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cellByClass(row, className) {
  const re = new RegExp(`<td\\b[^>]*class=["'][^"']*${escapeRegExp(className)}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i');
  return row.match(re)?.[1] || '';
}

function attr(tag, name) {
  const re = new RegExp(`${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  return decodeHtml(tag.match(re)?.[2] || '').trim();
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
  const absolute = absoluteOfficial(value, pageUrl);
  if (!absolute) return '';
  try {
    const url = new URL(absolute);
    url.searchParams.delete('width');
    return url.href;
  } catch {
    return absolute;
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Official roster request failed (${response.status}).`);
  return response.text();
}

function parseRosterHtml(html, pageUrl) {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const titleSeason = Number(title.match(/(20\d{2})\s+Football Roster/i)?.[1] || 0) || null;
  const pathSeason = Number(new URL(pageUrl).pathname.match(/\/roster\/(20\d{2})\/?$/)?.[1] || 0) || null;
  const rosterSeason = pathSeason || titleSeason || null;
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  const players = [];
  const seen = new Set();

  for (const row of rows) {
    if (!/sidearm-table-player-name/i.test(row) || !/roster_jerseynum/i.test(row)) continue;
    const nameCell = cellByClass(row, 'sidearm-table-player-name');
    const linkMatch = nameCell.match(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const name = cleanText(linkMatch[3]);
    const profile = absoluteOfficial(linkMatch[2], pageUrl);
    if (!name || !profile || !/\/sports\/football\/roster\//i.test(profile)) continue;

    const number = cleanText(cellByClass(row, 'roster_jerseynum')).match(/\d{1,3}/)?.[0] || '';
    const position = cleanText(cellByClass(row, 'rp_position_short'));
    const height = cleanText(cellByClass(row, 'height'));
    const weight = cleanText(cellByClass(row, 'rp_weight')).replace(/\s*lbs?\.?$/i, '');
    const playerClass = cleanText(cellByClass(row, 'roster_class'));
    const hometown = cleanText(cellByClass(row, 'player_hometown'));
    const previousSchool = cleanText(cellByClass(row, 'player_highschool'));

    const imageCell = cellByClass(row, 'image_combined_path');
    const imgTag = imageCell.match(/<img\b[^>]*>/i)?.[0] || '';
    const rawImage = attr(imgTag, 'data-src') || attr(imgTag, 'data-original') || attr(imgTag, 'src');
    const image = highResImage(rawImage, pageUrl);

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
  const html = await fetchHtml(url.href);
  const result = parseRosterHtml(html, url.href);
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
    return sendJson(res, 200, { ok: true, service: 'southeastern-roster-sync', version: '10.0', savesTo: `${BUCKET}/${OBJECT_PATH}` });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const body = await readJsonBody(req);
    const { adminKey } = environment();
    const internalBootstrap = req.__internalSelaBootstrap === true;
    if (!internalBootstrap) {
      if (!adminKey) throw new Error('SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.');
      if (String(body.adminKey || '') !== adminKey) return sendJson(res, 403, { error: 'Incorrect admin key.' });
    }

    const rosterUrl = validateRosterUrl(body.url || 'https://lionsports.net/sports/football/roster');
    const historicalUrl = validateRosterUrl(body.secondaryUrl || 'https://lionsports.net/sports/football/roster/2025');
    const [current, historical] = await Promise.all([
      scrapeRoster(rosterUrl.href),
      scrapeRoster(historicalUrl.href)
    ]);
    const players = mergeRosters(current, historical);

    await saveRosterToSupabase(players, {
      source: `${current.source} | ${historical.source}`,
      teamName: body.teamName || 'Southeastern Louisiana',
      nickname: body.nickname || 'Lions',
      teamCode: body.teamCode || 'LASE'
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
    console.error('Southeastern roster sync error:', error);
    return sendJson(res, 500, { error: error?.message || 'Roster sync failed.' });
  }
}
