import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import net from 'node:net';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clean(value = '') {
  return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function absolute(value, base) {
  if (!value) return '';
  try { return new URL(value, base).href; } catch { return ''; }
}

function firstText($root, selectors) {
  for (const selector of selectors) {
    const value = clean($root.find(selector).first().text());
    if (value) return value;
  }
  return '';
}

function firstAttr($root, selectors, attrs) {
  for (const selector of selectors) {
    const el = $root.find(selector).first();
    if (!el.length) continue;
    for (const attr of attrs) {
      let value = el.attr(attr);
      if (!value) continue;
      if (attr === 'srcset') value = value.split(',').pop().trim().split(/\s+/)[0];
      return clean(value);
    }
  }
  return '';
}

function fieldFromLabels($root, labels) {
  const wanted = labels.map(x => x.toLowerCase());
  let answer = '';
  $root.find('dt, .sidearm-roster-player-label, .sidearm-roster-player-details-label, strong').each((_, el) => {
    if (answer) return;
    const label = clean(cheerio.load(el).text()).replace(/:$/, '').toLowerCase();
    if (!wanted.some(x => label === x || label.includes(x))) return;
    const $el = $root.find(el);
    answer = clean($el.next('dd, span, div').first().text());
    if (!answer) answer = clean($el.parent().text()).replace(new RegExp('^' + label + '\\s*:?\\s*', 'i'), '');
  });
  return answer;
}

function parseRoster(html, baseUrl) {
  const $ = cheerio.load(html);
  const cards = $('.sidearm-roster-player, li.sidearm-roster-player, .roster-player, [data-player-id]').toArray();
  const players = [];
  const seen = new Set();

  for (const card of cards) {
    const $card = $(card);
    let name = firstText($card, [
      '.sidearm-roster-player-name h3',
      '.sidearm-roster-player-name',
      '.roster-player-name',
      'h3 a[href*="/roster/"]',
      'a[href*="/roster/"]'
    ]).replace(/^\d+\s+/, '');
    if (!name || name.length > 100) continue;

    let number = firstText($card, [
      '.sidearm-roster-player-jersey-number',
      '.sidearm-roster-player-jersey',
      '.roster-player-number'
    ]).replace(/[^0-9]/g, '');

    const position = firstText($card, [
      '.sidearm-roster-player-position',
      '.roster-player-position'
    ]) || fieldFromLabels($card, ['position', 'pos']);

    const height = firstText($card, ['.sidearm-roster-player-height']) || fieldFromLabels($card, ['height', 'ht']);
    const weight = (firstText($card, ['.sidearm-roster-player-weight']) || fieldFromLabels($card, ['weight', 'wt'])).replace(/\s*lbs?\.?$/i, '');
    const academicClass = firstText($card, [
      '.sidearm-roster-player-academic-year',
      '.sidearm-roster-player-year',
      '.sidearm-roster-player-class'
    ]) || fieldFromLabels($card, ['class', 'year', 'academic year']);
    const hometown = firstText($card, ['.sidearm-roster-player-hometown']) || fieldFromLabels($card, ['hometown']);
    const highSchool = firstText($card, ['.sidearm-roster-player-highschool', '.sidearm-roster-player-high-school']) || fieldFromLabels($card, ['high school']);
    const previousSchool = firstText($card, ['.sidearm-roster-player-previous-school']) || fieldFromLabels($card, ['previous school', 'last school']);

    const profileRaw = firstAttr($card, ['a[href*="/roster/"]'], ['href']);
    const imageRaw = firstAttr($card, [
      '.sidearm-roster-player-image img',
      '.sidearm-roster-player-photo img',
      'img'
    ], ['data-src', 'data-original', 'data-lazy-src', 'srcset', 'src']);

    const profile = absolute(profileRaw, baseUrl);
    const image = absolute(imageRaw, baseUrl);
    const key = `${number}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({
      number,
      name,
      position,
      height,
      weight,
      class: academicClass,
      hometown,
      highSchool,
      previousSchool,
      image,
      profile,
      bio: ''
    });
  }

  return players;
}

function isPrivateAddress(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.') || ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('192.168.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;
  return false;
}

async function validateUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a valid roster URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https roster URLs are allowed.');
  if (!url.hostname || url.username || url.password) throw new Error('The roster URL is not allowed.');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(r => isPrivateAddress(r.address))) throw new Error('That roster host is not publicly reachable.');
  return url;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = await validateUrl(body.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; FootballIntelligenceRosterImporter/1.0)',
          'accept': 'text/html,application/xhtml+xml'
        }
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return reply(502, { error: `The roster website returned HTTP ${response.status}.` });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) return reply(415, { error: 'The URL did not return an HTML roster page.' });
    const html = await response.text();
    if (html.length > 8_000_000) return reply(413, { error: 'The roster page was too large to import safely.' });
    const players = parseRoster(html, response.url || url.href);
    if (!players.length) return reply(422, { error: 'The page loaded, but its roster layout was not recognized. Use the official full-team roster page or upload CSV/JSON.' });
    return reply(200, { source: response.url || url.href, count: players.length, players });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'The roster website took too long to respond.' : (error?.message || 'Roster import failed.');
    return reply(400, { error: message });
  }
}

export function GET() {
  return reply(200, { ok: true, service: 'roster-importer', method: 'POST', version: '1.0' });
}
