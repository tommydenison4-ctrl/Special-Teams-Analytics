import dns from 'node:dns/promises';
import net from 'node:net';

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

function clean(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, name) {
  const match = html.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? match[1] : '';
}

function absolute(value, base) {
  if (!value) return '';
  try {
    return new URL(value, base).href;
  } catch {
    return '';
  }
}

function extractByClass(block, names) {
  for (const name of names) {
    const pattern = new RegExp(
      `<[^>]+class=["'][^"']*${name}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      'i'
    );
    const match = block.match(pattern);
    if (match && clean(match[1])) return clean(match[1]);
  }
  return '';
}

function extractLink(block) {
  const match = block.match(/<a[^>]+href=["']([^"']*\/roster\/[^"']*)["'][^>]*>/i);
  return match ? match[1] : '';
}

function extractImage(block) {
  const match = block.match(/<img[^>]+>/i);
  if (!match) return '';
  const tag = match[0];
  return (
    attr(tag, 'data-src') ||
    attr(tag, 'data-original') ||
    attr(tag, 'data-lazy-src') ||
    attr(tag, 'src')
  );
}

function parseCards(html, baseUrl) {
  const starts = [];
  const cardPattern = /<(?:li|div|article)[^>]+class=["'][^"']*(?:sidearm-roster-player|roster-player)[^"']*["'][^>]*>/gi;
  let match;
  while ((match = cardPattern.exec(html))) starts.push({ index: match.index });

  const players = [];
  const seen = new Set();

  for (let index = 0; index < starts.length; index += 1) {
    const end = starts[index + 1]?.index || Math.min(html.length, starts[index].index + 20000);
    const block = html.slice(starts[index].index, end);

    let name = extractByClass(block, ['sidearm-roster-player-name', 'roster-player-name']);
    name = name.replace(/^\s*#?\d+\s+/, '').trim();
    if (!name || name.length > 100) continue;

    const number = extractByClass(block, [
      'sidearm-roster-player-jersey-number',
      'sidearm-roster-player-jersey',
      'roster-player-number'
    ]).replace(/\D/g, '');

    const player = {
      number,
      name,
      position: extractByClass(block, ['sidearm-roster-player-position', 'roster-player-position']),
      height: extractByClass(block, ['sidearm-roster-player-height']),
      weight: extractByClass(block, ['sidearm-roster-player-weight']).replace(/\s*lbs?\.?$/i, ''),
      class: extractByClass(block, [
        'sidearm-roster-player-academic-year',
        'sidearm-roster-player-year',
        'sidearm-roster-player-class'
      ]),
      hometown: extractByClass(block, ['sidearm-roster-player-hometown']),
      highSchool: extractByClass(block, [
        'sidearm-roster-player-highschool',
        'sidearm-roster-player-high-school'
      ]),
      previousSchool: extractByClass(block, ['sidearm-roster-player-previous-school']),
      image: absolute(extractImage(block), baseUrl),
      profile: absolute(extractLink(block), baseUrl),
      bio: ''
    };

    const key = `${player.number}|${player.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    players.push(player);
  }

  return players;
}

function parseJsonLd(html, baseUrl) {
  const players = [];
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const list = node?.itemListElement || [];
        for (const entry of list) {
          const item = entry?.item || entry;
          if (!item?.name) continue;
          players.push({
            number: '',
            name: clean(item.name),
            position: '',
            height: '',
            weight: '',
            class: '',
            hometown: '',
            highSchool: '',
            previousSchool: '',
            image: absolute(Array.isArray(item.image) ? item.image[0] : item.image, baseUrl),
            profile: absolute(item.url, baseUrl),
            bio: clean(item.description || '')
          });
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks and continue looking.
    }
  }

  return players;
}

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (/^(10|127|169\.254|192\.168)\./.test(ip)) return true;
  const private172 = ip.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return /^(fc|fd|fe80:)/i.test(ip);
}

async function validatePublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid roster URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('That roster URL is not allowed.');
  }

  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error('That roster host is not publicly reachable.');
  }

  return url;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'roster-importer',
      version: '7.4',
      method: 'POST'
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readJsonBody(req);
    const rosterUrl = await validatePublicUrl(body.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    let response;
    try {
      response = await fetch(rosterUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; FootballIntelligenceRosterImporter/1.0)',
          accept: 'text/html,application/xhtml+xml'
        }
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return sendJson(res, 502, {
        error: `The roster website returned HTTP ${response.status}.`
      });
    }

    const html = await response.text();
    if (html.length > 8_000_000) {
      return sendJson(res, 413, {
        error: 'The roster page was too large to import safely.'
      });
    }

    let players = parseCards(html, response.url || rosterUrl.href);
    if (!players.length) players = parseJsonLd(html, response.url || rosterUrl.href);

    if (!players.length) {
      return sendJson(res, 422, {
        error: 'The page loaded, but its roster layout was not recognized. Upload a roster CSV or JSON file instead.'
      });
    }

    return sendJson(res, 200, {
      source: response.url || rosterUrl.href,
      count: players.length,
      players
    });
  } catch (error) {
    console.error('Roster API error:', error);
    const message =
      error?.name === 'AbortError'
        ? 'The roster website took too long to respond.'
        : error?.message || 'Roster import failed.';
    return sendJson(res, 400, { error: message });
  }
}
