import dns from 'node:dns/promises';
import net from 'node:net';
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  const adminKey = process.env.SPECIAL_TEAMS_ADMIN_KEY;
  return { url, key, adminKey };
}


function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (/^(10|127|169\.254|192\.168)\./.test(ip)) return true;
  const private172 = ip.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return /^(fc|fd|fe80:)/i.test(ip);
}

async function validatePublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
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
    defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: 'shell'
  });
}

async function scrapeRoster(url) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'font' || type === 'media') request.abort();
      else request.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    await page.waitForFunction(
      () => {
        const body = document.body?.innerText || '';
        return body.includes('Jersey Number') ||
          document.querySelectorAll('a[href*="/sports/football/roster/"]').length > 20;
      },
      { timeout: 20_000 }
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));

    return page.evaluate(() => {
      const clean = (value) =>
        String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

      const absolute = (value) => {
        try {
          return value ? new URL(value, window.location.href).href : '';
        } catch {
          return '';
        }
      };

      const normalizeName = (value) =>
        clean(value)
          .toLowerCase()
          .replace(/[“”"'’.,()]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const bestImageFromNode = (root, playerName='') => {
        if (!root) return '';
        const target = normalizeName(playerName);
        const candidates = [];

        root.querySelectorAll('img,source').forEach((el) => {
          const raw =
            el.getAttribute('data-src') ||
            el.getAttribute('data-original') ||
            el.getAttribute('data-lazy-src') ||
            el.getAttribute('src') ||
            el.getAttribute('srcset') ||
            '';

          if (!raw) return;

          // For srcset, choose the largest/final URL.
          let url = raw;
          if (raw.includes(',')) {
            const parts = raw.split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
            if (parts.length) url = parts[parts.length - 1];
          }

          url = absolute(url);
          if (!url) return;

          const alt = normalizeName(el.getAttribute('alt') || '');
          const srcLower = url.toLowerCase();

          // Ignore obvious non-player graphics.
          if (/logo|icon|sprite|placeholder|advert|banner|sponsor/.test(srcLower)) return;

          let score = 0;
          if (target && alt.includes(target)) score += 100;
          if (/headshot|headshots|roster|production|_web_|web_/.test(srcLower)) score += 30;
          if (/sidearmdev|cloudfront/.test(srcLower)) score += 15;

          const w = Number(el.getAttribute('width') || 0);
          const h = Number(el.getAttribute('height') || 0);
          if (w >= 200 || h >= 200) score += 10;

          candidates.push({ url, score });
        });

        candidates.sort((a,b) => b.score - a.score);
        return candidates[0]?.url || '';
      };

      const textBetween = (text, startLabel, endLabels) => {
        const start = text.indexOf(startLabel);
        if (start === -1) return '';
        const from = start + startLabel.length;
        let to = text.length;
        for (const label of endLabels) {
          const i = text.indexOf(label, from);
          if (i !== -1 && i < to) to = i;
        }
        return clean(text.slice(from, to));
      };

      // Build profile + image maps from actual roster anchors/cards.
      const profiles = new Map();
      const images = new Map();

      document.querySelectorAll(
        'a[href*="/sports/football/roster/"],a[href*="/roster/"]'
      ).forEach((a) => {
        const href = absolute(a.getAttribute('href'));
        let name = clean(a.textContent)
          .replace(/^Full Bio for\s+/i, '')
          .replace(/^Expand for more info about\s+/i, '')
          .replace(/^Jersey Number\s+\d+\s*/i, '')
          .trim();

        if (!href || !name || name.length >= 100 || /^Roster$/i.test(name) || /^Football$/i.test(name)) {
          return;
        }

        const key = normalizeName(name);
        profiles.set(key, href);

        // Walk upward until we find the player's roster card/list item and pull its image.
        let node = a;
        let image = '';
        for (let depth = 0; depth < 8 && node && !image; depth += 1) {
          image = bestImageFromNode(node, name);
          node = node.parentElement;
        }

        if (image) images.set(key, image);
      });

      let text = clean(document.body.innerText);
      [
        'Jersey Number','Position','Academic Year','Class','Height','Weight',
        'Custom Field 1','Hometown','Last School','Previous School',
        'Full Bio for','Expand for more info about'
      ].forEach((label) => {
        text = text.replace(new RegExp(label, 'gi'), ` ${label} `);
      });

      const players = [];
      const seen = new Set();
      const blocks = text.split(/\s+Jersey Number\s+/i);

      for (let index = 1; index < blocks.length; index += 1) {
        const block = clean(blocks[index]);
        const numberMatch = block.match(/^(\d{1,3})\s+/);
        if (!numberMatch) continue;

        const number = numberMatch[1];
        const remainder = clean(block.slice(numberMatch[0].length));
        const positionIndex = remainder.indexOf('Position');
        if (positionIndex === -1) continue;

        const name = clean(remainder.slice(0, positionIndex));
        if (!name || name.length > 100) continue;

        const position = textBetween(remainder, 'Position', ['Academic Year', 'Class']);
        let playerClass = textBetween(remainder, 'Academic Year', ['Height']);
        if (!playerClass) playerClass = textBetween(remainder, 'Class', ['Height']);

        const height = textBetween(remainder, 'Height', ['Weight']);
        const weight = textBetween(
          remainder, 'Weight', ['Custom Field 1', 'Hometown']
        ).replace(/\s*lbs?\.?$/i, '');

        const hometown = textBetween(
          remainder, 'Hometown', ['Last School', 'Previous School']
        );

        let previousSchool = textBetween(remainder, 'Last School', ['Full Bio for']);
        if (!previousSchool) {
          previousSchool = textBetween(remainder, 'Previous School', ['Full Bio for']);
        }

        const key = `${number}|${normalizeName(name)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const nameKey = normalizeName(name);

        players.push({
          number,
          name,
          position,
          class: playerClass,
          height,
          weight,
          hometown,
          previousSchool,
          image: images.get(nameKey) || '',
          profile: profiles.get(nameKey) || '',
          bio: ''
        });
      }

      return {
        source: window.location.href,
        pageTitle: document.title,
        players
      };
    });
  } finally {
    await browser.close();
  }
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
    return sendJson(res, 200, {
      ok: true,
      service: 'special-teams-roster-sync',
      version: '8.4',
      savesTo: `${BUCKET}/${OBJECT_PATH}`
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readJsonBody(req);
    const { adminKey } = environment();
    if (!adminKey) throw new Error('SPECIAL_TEAMS_ADMIN_KEY is not configured in Vercel.');
    if (String(body.adminKey || '') !== adminKey) throw new Error('Incorrect admin key.');
    const rosterUrl = await validatePublicUrl(body.url);
    const result = await scrapeRoster(rosterUrl.href);

    if (!result.players.length) {
      return sendJson(res, 422, {
        error: 'The roster page rendered, but no players were recognized.',
        pageTitle: result.pageTitle,
        source: result.source
      });
    }

    await saveRosterToSupabase(result.players, {
      source: result.source,
      teamName: body.teamName,
      nickname: body.nickname,
      teamCode: body.teamCode
    });

    return sendJson(res, 200, {
      ok: true,
      count: result.players.length,
      source: result.source,
      storedAt: `${BUCKET}/${OBJECT_PATH}`
    });
  } catch (error) {
    console.error('Roster sync error:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Roster sync failed.'
    });
  }
}
