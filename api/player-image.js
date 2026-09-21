import dns from 'node:dns/promises';
import net from 'node:net';

const TEAM_ROSTERS = {
  fau: 'https://fausports.com/sports/football/roster/',
  sela: 'https://lionsports.net/sports/football/roster/2026',
  southeastern: 'https://lionsports.net/sports/football/roster/2026'
};

function allowedHost(host='') {
  host=String(host).toLowerCase();
  return host==='lionsports.net' || host.endsWith('.lionsports.net') ||
    host==='uabsports.com' || host.endsWith('.uabsports.com') ||
    host==='fausports.com' || host.endsWith('.fausports.com') ||
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

function decodeHtml(value='') {
  return String(value)
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&nbsp;/gi,' ')
    .replace(/\\\//g,'/');
}

function strip(value='') {
  return decodeHtml(String(value||''))
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function norm(value='') {
  return strip(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}

async function validateImageUrl(raw) {
  let url;
  try { url = raw instanceof URL ? raw : new URL(String(raw || '')); }
  catch { throw new Error('Invalid image URL'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsupported image URL');
  if (!allowedHost(url.hostname)) throw new Error('Image host is not allowed');
  await publicDns(url.hostname);
  return url;
}

async function validateProfileUrl(raw) {
  let url;
  try { url = raw instanceof URL ? raw : new URL(String(raw || '')); }
  catch { throw new Error('Invalid roster profile URL'); }
  const host=url.hostname.toLowerCase();
  const hostOk=(host==='lionsports.net'||host.endsWith('.lionsports.net')||
                host==='fausports.com'||host.endsWith('.fausports.com')||
                host==='uabsports.com'||host.endsWith('.uabsports.com'));
  const rosterPath = url.pathname === '/sports/football/roster' ||
                     url.pathname === '/sports/football/roster/' ||
                     url.pathname.startsWith('/sports/football/roster/');
  if (url.protocol !== 'https:' || url.username || url.password || !hostOk || !rosterPath) {
    throw new Error('Unsupported roster profile URL');
  }
  await publicDns(url.hostname);
  return url;
}

async function fetchManual(startUrl, kind='image') {
  let url = kind==='html' ? await validateProfileUrl(startUrl) : await validateImageUrl(startUrl);
  const maxRedirects = kind==='html' ? 4 : 5;
  for (let i=0;i<maxRedirects;i++) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    let response;
    try {
      response=await fetch(url,{
        redirect:'manual',
        signal:controller.signal,
        headers: kind==='html' ? {
          'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36',
          accept:'text/html,application/xhtml+xml',
          'accept-language':'en-US,en;q=0.9'
        } : {
          'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36',
          accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'accept-language':'en-US,en;q=0.9',
          referer:`${url.protocol}//${url.host}/`
        }
      });
    } finally { clearTimeout(timer); }
    if ([301,302,303,307,308].includes(response.status)) {
      const loc=response.headers.get('location');
      if(!loc)throw new Error('Redirect did not include a location');
      url = kind==='html' ? await validateProfileUrl(new URL(loc,url)) : await validateImageUrl(new URL(loc,url));
      continue;
    }
    return {response,url};
  }
  throw new Error('Too many redirects');
}

function attrs(tag,pageUrl) {
  const out=[];
  const add=raw=>{
    if(!raw)return;
    try {
      const u=new URL(decodeHtml(raw),pageUrl);
      if(u.protocol==='https:'&&allowedHost(u.hostname)&&!out.includes(u.href))out.push(u.href);
    } catch {}
  };
  for(const key of ['src','data-src','data-original','data-lazy-src','data-lazy','data-image']) {
    const m=String(tag).match(new RegExp(`${key}=["']([^"']+)["']`,'i'));
    if(m?.[1])add(m[1]);
  }
  const ss=String(tag).match(/srcset=["']([^"']+)["']/i);
  if(ss?.[1])ss[1].split(',').forEach(x=>add(x.trim().split(/\s+/)[0]));
  return out;
}

function goodImage(url='') {
  const s=String(url).toLowerCase();
  return /images\.sidearmdev\.com|images\.sidearmsports\.com|cloudfront\.net|lionsports\.net\/images\/|fausports\.com\/images\/|uabsports\.com\/images\//i.test(s) &&
    !/(logo|wordmark|sponsor|icon|placeholder|default|story|stadium|facility|banner)/i.test(s);
}

function scoreImage(url='', tag='', playerName='') {
  const s=(String(url)+' '+String(tag)).toLowerCase();
  let score=0;
  if(/\/images\/2026\//.test(s))score+=80;
  if(/roster|headshot|portrait|player-image|roster-player/.test(s))score+=100;
  if(/_fb_2026_|football/.test(s))score+=40;
  if(playerName && norm(s).includes(norm(playerName)))score+=220;
  if(/action|gallery|story|team-photo/.test(s))score-=100;
  if(/logo|wordmark|sponsor|icon|placeholder|default|stadium|facility|banner/.test(s))score-=250;
  return score;
}

function exactPlayerImage(html, playerName, pageUrl) {
  if(!playerName)return '';
  const target=norm(playerName);
  let best='',bestScore=-999;
  for(const m of String(html||'').matchAll(/<img\b[^>]*>/gi)) {
    const tag=m[0];
    const alt=(tag.match(/alt=["']([^"']*)["']/i)||[])[1]||'';
    const title=(tag.match(/title=["']([^"']*)["']/i)||[])[1]||'';
    const tagMatches = norm(alt)===target || norm(title)===target || norm(tag).includes(target);
    for(const u of attrs(tag,pageUrl)) {
      if(!goodImage(u))continue;
      let score=scoreImage(u,tag,playerName)+(tagMatches?500:0);
      if(score>bestScore){bestScore=score;best=u;}
    }
  }
  return bestScore>0?best:'';
}

function genericCandidates(html,pageUrl,playerName='') {
  const found=[];
  const add=(raw,tag='')=>{
    if(!raw)return;
    try{
      const u=new URL(decodeHtml(raw),pageUrl);
      if(u.protocol!=='https:'||!allowedHost(u.hostname)||!goodImage(u.href))return;
      if(!found.some(x=>x.url===u.href))found.push({url:u.href,tag});
    }catch{}
  };
  for(const m of String(html||'').matchAll(/<img\b[^>]*>/gi))attrs(m[0],pageUrl).forEach(u=>add(u,m[0]));
  for(const re of [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/ig,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/ig
  ]){let m;while((m=re.exec(html)))add(m[1],m[0]);}
  (decodeHtml(html).match(/https:\/\/[^"'<>\s]+?\.(?:jpe?g|png|webp)(?:\?[^"'<>\s]*)?/ig)||[]).forEach(u=>add(u,''));
  return found.sort((a,b)=>scoreImage(b.url,b.tag,playerName)-scoreImage(a.url,a.tag,playerName)).map(x=>x.url);
}

function profileLinkForName(html,name,pageUrl) {
  const target=norm(name);
  if(!target)return '';
  for(const m of String(html||'').matchAll(/<a\b[^>]+href=["']([^"']*\/sports\/football\/roster\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if(norm(m[2])!==target)continue;
    try{return new URL(decodeHtml(m[1]),pageUrl).href;}catch{}
  }
  return '';
}

async function imageFromProfile(profile,name='') {
  const got=await fetchManual(profile,'html');
  if(!got.response.ok)throw new Error(`Roster profile returned ${got.response.status}`);
  const html=await got.response.text();
  const pageUrl=got.url;
  const exact=exactPlayerImage(html,name,pageUrl);
  const candidates=[exact,...genericCandidates(html,pageUrl,name)].filter(Boolean);
  let lastError;
  for(const candidate of [...new Set(candidates)].slice(0,12)) {
    try {
      const gotImage=await fetchManual(candidate,'image');
      const r=gotImage.response;
      if(!r.ok)continue;
      const type=String(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!type.startsWith('image/'))continue;
      return r;
    } catch(e){lastError=e;}
  }
  throw lastError||new Error('Official roster headshot could not be loaded');
}

async function imageFromName(name,team='') {
  const key=String(team||'').toLowerCase();
  const rosterUrl=TEAM_ROSTERS[key]||TEAM_ROSTERS.sela;
  const got=await fetchManual(rosterUrl,'html');
  if(!got.response.ok)throw new Error(`Roster returned ${got.response.status}`);
  const html=await got.response.text();
  const pageUrl=got.url;
  const profile=profileLinkForName(html,name,pageUrl);
  if(profile)return imageFromProfile(profile,name);
  const exact=exactPlayerImage(html,name,pageUrl);
  if(exact){
    const img=await fetchManual(exact,'image');
    if(img.response.ok)return img.response;
  }
  throw new Error('No official roster headshot found');
}

export default async function handler(req,res) {
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  try {
    const q=k=>Array.isArray(req.query?.[k])?req.query[k][0]:req.query?.[k];
    const raw=q('url'), profile=q('profile'), name=q('name'), team=q('team');
    let upstream;
    if(profile) upstream=await imageFromProfile(profile,name||'');
    else if(name) upstream=await imageFromName(name,team||'');
    else if(raw) upstream=(await fetchManual(raw,'image')).response;
    else return res.status(400).json({error:'Missing image URL, profile, or player name'});

    if(!upstream.ok)return res.status(upstream.status||502).json({error:`Image host returned ${upstream.status}`});
    const type=String(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!type.startsWith('image/'))return res.status(502).json({error:'Upstream URL did not return an image'});
    const body=Buffer.from(await upstream.arrayBuffer());
    if(!body.length||body.length>8*1024*1024)return res.status(502).json({error:'Image response was empty or too large'});
    res.setHeader('Content-Type',type);
    res.setHeader('Content-Length',String(body.length));
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(body);
  } catch(error) {
    const status=error?.name==='AbortError'?504:400;
    const message=error?.name==='AbortError'?'Image request timed out':(error?.message||'Image proxy failed');
    return res.status(status).json({error:message});
  }
}
