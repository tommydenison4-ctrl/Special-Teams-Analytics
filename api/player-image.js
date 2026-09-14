import dns from 'node:dns/promises';
import net from 'node:net';

const SELA_ROSTER_URL='https://lionsports.net/sports/football/roster/2026';

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

async function publicDns(host) {
  const records = await dns.lookup(host, { all: true });
  if (!records.length || records.some(r => isPrivateIp(r.address))) {
    throw new Error('Remote host is not publicly reachable');
  }
}

async function validateUrl(raw) {
  let url;
  try { url = raw instanceof URL ? raw : new URL(String(raw || '')); }
  catch { throw new Error('Invalid image URL'); }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Unsupported image URL');
  }
  if (!allowedHost(url.hostname)) throw new Error('Image host is not allowed');
  await publicDns(url.hostname);
  return url;
}

async function validateProfileUrl(raw) {
  let url;
  try { url = raw instanceof URL ? raw : new URL(String(raw || '')); }
  catch { throw new Error('Invalid roster profile URL'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password ||
      !(host === 'lionsports.net' || host.endsWith('.lionsports.net')) ||
      !url.pathname.startsWith('/sports/football/roster/')) {
    throw new Error('Unsupported roster profile URL');
  }
  await publicDns(url.hostname);
  return url;
}

async function fetchImage(startUrl) {
  let url = await validateUrl(startUrl);
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
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

async function fetchProfileHtml(startUrl) {
  let url = await validateProfileUrl(startUrl);
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
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9'
        }
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Roster profile redirect did not include a location');
      url = await validateProfileUrl(new URL(location, url));
      continue;
    }
    if (!response.ok) throw new Error(`Roster profile returned ${response.status}`);
    return { html: await response.text(), pageUrl: url };
  }
  throw new Error('Too many roster profile redirects');
}

function htmlDecode(value='') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\\//g, '/');
}

function strip(value='') {
  return htmlDecode(String(value||''))
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function norm(value='') {
  return strip(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}

function imageCandidates(html, pageUrl) {
  const normalized = htmlDecode(html);
  const found = [];
  const add = raw => {
    if (!raw) return;
    try {
      const url = new URL(htmlDecode(raw), pageUrl);
      if (url.protocol !== 'https:' || !allowedHost(url.hostname)) return;
      const href = url.href;
      if (!found.includes(href)) found.push(href);
    } catch {}
  };

  for (const re of [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/ig,
    /(?:src|data-src|data-original)=["']([^"']+)["']/ig
  ]) {
    let match;
    while ((match = re.exec(normalized))) add(match[1]);
  }

  (normalized.match(/https:\/\/[^"'<>\s]+?\.(?:jpe?g|png|webp)(?:\?[^"'<>\s]*)?/ig) || []).forEach(add);
  (normalized.match(/\/images\/20\d{2}\/[^"'<>\s]+?\.(?:jpe?g|png|webp)(?:\?[^"'<>\s]*)?/ig) || []).forEach(add);

  return found.sort((a,b) => scoreImage(b) - scoreImage(a));
}

function scoreImage(url='') {
  const s = String(url).toLowerCase();
  let score = 0;
  if (s.includes('/images/2026/')) score += 80;
  if (s.includes('_fb_2026_web_')) score += 120;
  if (s.includes('sidearm.nextgen.sites/lionsports.net')) score += 50;
  if (/\/roster\//.test(s)) score += 20;
  if (s.includes('action')) score -= 90;
  if (/(logo|snapshot|icon|placeholder|sponsor|adserver)/.test(s)) score -= 150;
  return score;
}

function officialImageAttrs(tag, pageUrl) {
  const out=[];
  const add=raw=>{
    if(!raw)return;
    try{
      const u=new URL(htmlDecode(raw),pageUrl);
      if(u.protocol==='https:'&&allowedHost(u.hostname)&&!out.includes(u.href))out.push(u.href);
    }catch{}
  };
  for(const key of ['src','data-src','data-original','data-lazy-src','data-lazy','data-image']){
    const m=String(tag).match(new RegExp(`${key}=["']([^"']+)["']`,'i'));
    if(m?.[1])add(m[1]);
  }
  const ss=String(tag).match(/srcset=["']([^"']+)["']/i);
  if(ss?.[1])ss[1].split(',').forEach(part=>add(part.trim().split(/\s+/)[0]));
  return out;
}

function officialGood(url='') {
  const s=String(url).toLowerCase();
  return /images\.sidearmdev\.com|dxbhsrqyrr690\.cloudfront\.net|lionsports\.net\/images\//i.test(s) &&
    !/(logo|wordmark|sponsor|icon|placeholder|default|story|stadium|facility)/i.test(s);
}

function exactAltPortrait(html,name,pageUrl) {
  const target=norm(name);
  for(const m of String(html||'').matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    const alt=(tag.match(/alt=["']([^"']*)["']/i)||[])[1]||'';
    const title=(tag.match(/title=["']([^"']*)["']/i)||[])[1]||'';
    if(norm(alt)!==target&&norm(title)!==target)continue;
    const urls=officialImageAttrs(tag,pageUrl).filter(officialGood);
    if(urls.length)return urls.sort((a,b)=>scoreImage(b)-scoreImage(a))[0];
  }
  return '';
}

function nearbyPortrait(html,name,pageUrl) {
  const source=String(html||'');
  const target=String(name||'').toLowerCase();
  if(!target)return '';
  let best='',bestScore=-999,idx=0;
  while((idx=source.toLowerCase().indexOf(target,idx))>=0){
    const start=Math.max(0,idx-3500),end=Math.min(source.length,idx+3500),win=source.slice(start,end);
    for(const m of win.matchAll(/<img\b[^>]*>/gi)){
      const tag=m[0],global=start+(m.index||0),dist=Math.abs(global-idx);
      for(const url of officialImageAttrs(tag,pageUrl)){
        if(!officialGood(url))continue;
        let score=scoreImage(url);
        if(norm(tag).includes(norm(name)))score+=200;
        if(/sidearm-roster-player-image|roster-player-image|roster-player-photo/i.test(tag))score+=120;
        score-=Math.min(140,Math.floor(dist/25));
        if(score>bestScore){bestScore=score;best=url;}
      }
    }
    idx+=target.length;
  }
  return bestScore>0?best:'';
}

function profileUrlForName(html,name,pageUrl) {
  const target=norm(name);
  for(const m of String(html||'').matchAll(/<a\b[^>]+href=["']([^"']*\/sports\/football\/roster\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    if(norm(m[2])!==target)continue;
    try{return new URL(htmlDecode(m[1]),pageUrl).href;}catch{}
  }
  return '';
}

function firstProfilePortrait(html,name,pageUrl) {
  let best='',bestScore=-999;
  for(const m of String(html||'').matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    for(const url of officialImageAttrs(tag,pageUrl)){
      if(!officialGood(url))continue;
      let score=scoreImage(url);
      if(norm(tag).includes(norm(name)))score+=160;
      if(/sidearm-roster-player-image|roster-player-image|headshot|portrait/i.test(tag+' '+url))score+=120;
      if(/action|gallery|story/i.test(url))score-=80;
      if(score>bestScore){bestScore=score;best=url;}
    }
  }
  return bestScore>0?best:'';
}

async function imageFromSelaName(name) {
  const clean=strip(name);
  if(!clean || clean.length>100)throw new Error('Invalid Southeastern Louisiana player name');
  const rosterPage=await fetchProfileHtml(SELA_ROSTER_URL);
  let image=exactAltPortrait(rosterPage.html,clean,rosterPage.pageUrl) || nearbyPortrait(rosterPage.html,clean,rosterPage.pageUrl);
  if(!image){
    const profile=profileUrlForName(rosterPage.html,clean,rosterPage.pageUrl);
    if(profile){
      const profilePage=await fetchProfileHtml(profile);
      image=exactAltPortrait(profilePage.html,clean,profilePage.pageUrl) || firstProfilePortrait(profilePage.html,clean,profilePage.pageUrl);
    }
  }
  if(!image)throw new Error('No official Southeastern Louisiana roster headshot found');
  const response=await fetchImage(image);
  if(!response.ok)throw new Error(`Official roster image returned ${response.status}`);
  return response;
}

async function imageFromProfile(profile) {
  const { html, pageUrl } = await fetchProfileHtml(profile);
  const candidates = imageCandidates(html, pageUrl);
  if (!candidates.length) throw new Error('No roster headshot was found on the official player profile');

  let lastError;
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const response = await fetchImage(candidate);
      if (!response.ok) continue;
      const type = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/')) continue;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Official roster headshot could not be loaded');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
    const profile = Array.isArray(req.query?.profile) ? req.query.profile[0] : req.query?.profile;
    const name = Array.isArray(req.query?.name) ? req.query.name[0] : req.query?.name;
    const upstream = name ? await imageFromSelaName(name) : (profile ? await imageFromProfile(profile) : await fetchImage(raw));
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
