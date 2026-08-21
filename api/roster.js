const BUCKET='Special Teams';
const OBJECT_PATH='Current/roster.json';

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
export default async function handler(req,res){
  if(req.method!=='GET') return sendJson(res,405,{error:'Method not allowed.'});
  try{
    const {url,key}=env();
    const r=await fetch(objectUrl(url),{
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:'no-store'
    });
    if(r.status===404) return sendJson(res,404,{error:'No roster.json found.'});
    if(!r.ok){
      const detail=await r.text();
      return sendJson(res,r.status,{error:`Supabase roster read failed (${r.status}): ${detail||'unknown error'}`});
    }
    const data=await r.json();
    return sendJson(res,200,data);
  }catch(error){
    return sendJson(res,500,{error:error?.message||'Roster read failed.'});
  }
}
