import dns from 'node:dns/promises';
import net from 'node:net';

function allowedHost(host='') {
  host=String(host).toLowerCase();
  return host==='lionsports.net' || host.endsWith('.lionsports.net') ||
    host==='uabsports.com' || host.endsWith('.uabsports.com') ||
    host==='images.sidearmdev.com' || host.endsWith('.sidearmdev.com') ||
    host==='images.sidearmsports.com' || host.endsWith('.sidearmsports.com') ||
    host.endsWith('.cloudfront.net');
}

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (/^(10|127|169\.254|192\.168)\./.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^(fc|fd|fe80:)/i.test(ip);
}

async function validateUrl(raw) {
  let url;
  try { url = raw instanceof URL ? raw : new URL(String(raw || '')); }
  catch { throw new Error('Invalid image URL'); }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Unsupported image URL');
  }
  if (!allowedHost(url.hostname)) throw new Error('Image host is not allowed');

  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(r => isPrivateIp(r.address))) {
    throw new Error('Image host is not publicly reachable');
  }
  return url;
}

async function fetchImage(startUrl) {
  let url = await validateUrl(startUrl);
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36',
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          referer: `${url.protocol}//${url.host}/`
        }
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Image redirect did not include a location');
      url = await validateUrl(new URL(location, url));
      continue;
    }
    return response;
  }
  throw new Error('Too many image redirects');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
    const upstream = await fetchImage(raw);
    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({ error: `Image host returned ${upstream.status}` });
    }

    const type = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) {
      return res.status(502).json({ error: 'Upstream URL did not return an image' });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    if (!body.length || body.length > 8 * 1024 * 1024) {
      return res.status(502).json({ error: 'Image response was empty or too large' });
    }

    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(body);
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : 400;
    const message = error?.name === 'AbortError' ? 'Image request timed out' : (error?.message || 'Image proxy failed');
    return res.status(status).json({ error: message });
  }
}
