const BUCKET='Special Teams';
const OBJECT_PATH='Opponents/FloridaAtlantic/roster.json';

function sendJson(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function env(){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return {url,key};
}
function objectUrl(base){
  const bucket=encodeURIComponent(BUCKET);
  const path=OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/${bucket}/${path}`;
}
function proxyImageUrl(raw){
  const value=String(raw||'').trim();
  if(!/^https:\/\//i.test(value)) return value;
  return `/api/player-image?url=${encodeURIComponent(value)}`;
}
function proxyRosterImages(data){
  const patch=(player)=>player&&typeof player==='object'
    ? {...player,image:proxyImageUrl(player.image)}
    : player;
  if(Array.isArray(data)) return data.map(patch);
  if(data&&Array.isArray(data.players)) return {...data,players:data.players.map(patch)};
  return data;
}
export default async function handler(req,res){
  if(req.method!=='GET') return sendJson(res,405,{error:'Method not allowed.'});
  try{
    const {url,key}=env();
    const r=await fetch(objectUrl(url),{
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:'no-store'
    });
    if(r.status===404) return sendJson(res,404,{error:'No Florida Atlantic roster.json found in Opponents/SoutheasternLA.'});
    if(!r.ok){
      const detail=await r.text();
      return sendJson(res,r.status,{error:`Supabase Florida Atlantic roster read failed (${r.status}): ${detail||'unknown error'}`});
    }
    const data=proxyRosterImages(await r.json());
    return sendJson(res,200,data);
  }catch(error){
    return sendJson(res,500,{error:error?.message||'Florida Atlantic roster read failed.'});
  }
}
