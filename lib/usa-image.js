const ROSTER='https://usajaguars.com/sports/football/roster/';

function allowedProfile(raw){
  const u=new URL(String(raw||''));
  const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:' || !(h==='usajaguars.com'||h.endsWith('.usajaguars.com')) || !u.pathname.startsWith('/sports/football/roster/')) throw new Error('Unsupported South Alabama profile URL');
  return u;
}
function allowedImage(raw,base){
  const u=new URL(String(raw||''),base);
  const h=u.hostname.toLowerCase();
  const ok=h==='usajaguars.com'||h.endsWith('.usajaguars.com')||h==='images.sidearmdev.com'||h.endsWith('.sidearmdev.com')||h==='images.sidearmsports.com'||h.endsWith('.sidearmsports.com')||h.endsWith('.cloudfront.net');
  if(u.protocol!=='https:'||!ok)throw new Error('Unsupported South Alabama image host');
  return u;
}
function decode(v=''){return String(v).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\\\//g,'/');}
function strip(v=''){return decode(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function norm(v=''){return strip(v).toLowerCase().replace(/[^a-z0-9]/g,'');}
async function getHtml(url){
  const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36',accept:'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'}});
  if(!r.ok)throw new Error('South Alabama roster returned '+r.status);
  return {html:await r.text(),url:r.url||String(url)};
}
function profileForName(html,name,base){
  const target=norm(name);
  for(const m of html.matchAll(/<a\b[^>]+href=["']([^"']*\/sports\/football\/roster\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    if(norm(m[2])!==target)continue;
    try{return new URL(decode(m[1]),base).href}catch{}
  }
  return '';
}
function attr(tag,key){return (String(tag).match(new RegExp(key+'=["\\\']([^"\\\']+)["\\\']','i'))||[])[1]||'';}
function score(url,tag,name){
  const s=(String(url)+' '+String(tag)).toLowerCase();
  let n=0;
  if(/roster|headshot|portrait|player|football/.test(s))n+=100;
  if(name&&norm(s).includes(norm(name)))n+=300;
  if(/logo|wordmark|sponsor|icon|placeholder|banner|facility|stadium|story/.test(s))n-=300;
  return n;
}
function candidates(html,base,name=''){
  const out=[];
  const add=(raw,tag='')=>{if(!raw)return;try{const u=allowedImage(decode(raw),base);const href=u.href;if(!out.some(x=>x.href===href))out.push({href,tag,score:score(href,tag,name)});}catch{}};
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    for(const k of ['src','data-src','data-original','data-lazy-src','data-image'])add(attr(tag,k),tag);
    const ss=attr(tag,'srcset'); if(ss)ss.split(',').forEach(x=>add(x.trim().split(/\s+/)[0],tag));
  }
  for(const re of [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/ig]){let m;while((m=re.exec(html)))add(m[1],m[0]);}
  return out.sort((a,b)=>b.score-a.score).map(x=>x.href);
}
async function fetchImage(url){
  const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36',accept:'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',referer:'https://usajaguars.com/'}});
  if(!r.ok)throw new Error('South Alabama image returned '+r.status);
  const type=String(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!type.startsWith('image/'))throw new Error('South Alabama image URL did not return an image');
  return r;
}
export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  try{
    const q=k=>Array.isArray(req.query?.[k])?req.query[k][0]:req.query?.[k];
    const name=String(q('name')||'').trim(); let profile=String(q('profile')||'').trim();
    if(!profile){const root=await getHtml(ROSTER);profile=profileForName(root.html,name,root.url);if(!profile)throw new Error('South Alabama profile not found');}
    const p=allowedProfile(profile); const page=await getHtml(p);
    const list=candidates(page.html,page.url,name); if(!list.length)throw new Error('South Alabama headshot not found');
    let upstream,last;
    for(const url of list.slice(0,12)){try{upstream=await fetchImage(url);break}catch(e){last=e}}
    if(!upstream)throw last||new Error('South Alabama headshot not found');
    const type=String(upstream.headers.get('content-type')||'image/jpeg').split(';')[0];
    const body=Buffer.from(await upstream.arrayBuffer()); if(!body.length||body.length>8*1024*1024)throw new Error('Image response was empty or too large');
    res.setHeader('Content-Type',type);res.setHeader('Content-Length',String(body.length));res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');return res.status(200).send(body);
  }catch(e){return res.status(400).json({error:e?.message||'South Alabama image proxy failed'});}
}
