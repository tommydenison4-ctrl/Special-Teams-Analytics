const crypto = require('crypto');

function json(res,status,body){res.status(status).setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));}
function env(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return {url:url.replace(/\/$/,''),key};
}
function headers(key,extra={}){return {apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json',...extra};}
function id(){return crypto.randomBytes(9).toString('base64url');}
function secret(){return crypto.randomBytes(24).toString('base64url');}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex');}

module.exports=async function handler(req,res){
  try{
    const {url,key}=env();
    if(req.method==='GET'){
      const project=String(req.query.project||'').trim();
      if(!project)return json(res,400,{error:'Missing project ID'});
      const r=await fetch(`${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(project)}&select=id,data,updated_at`,{headers:headers(key)});
      const a=await r.json();if(!r.ok)throw new Error(a.message||'Database read failed');
      if(!a.length)return json(res,404,{error:'Project not found'});
      return json(res,200,{projectId:a[0].id,data:a[0].data,updatedAt:a[0].updated_at});
    }
    if(req.method==='POST'){
      let body=req.body||{}; if(typeof body==='string')body=JSON.parse(body);
      const data=body.data;
      if(!data||typeof data!=='object')return json(res,400,{error:'Missing project data'});
      if(JSON.stringify(data).length>12_000_000)return json(res,413,{error:'Project is too large for this build. Reduce the CSV size.'});
      let projectId=String(body.projectId||'').trim();
      let editKey=String(body.editKey||'').trim();
      if(!projectId){
        projectId=id();editKey=secret();
        const r=await fetch(`${url}/rest/v1/special_teams_projects`,{method:'POST',headers:headers(key,{Prefer:'return=minimal'}),body:JSON.stringify({id:projectId,edit_key_hash:hash(editKey),data})});
        if(!r.ok){const x=await r.text();throw new Error(x||'Database insert failed');}
        return json(res,200,{projectId,editKey,created:true});
      }
      if(!editKey)return json(res,403,{error:'This browser does not have the edit key for this project. Open a copy or create a new project.'});
      const check=await fetch(`${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(projectId)}&select=edit_key_hash`,{headers:headers(key)});
      const found=await check.json();if(!check.ok)throw new Error(found.message||'Database lookup failed');
      if(!found.length)return json(res,404,{error:'Project not found'});
      if(found[0].edit_key_hash!==hash(editKey))return json(res,403,{error:'Invalid edit key'});
      const r=await fetch(`${url}/rest/v1/special_teams_projects?id=eq.${encodeURIComponent(projectId)}`,{method:'PATCH',headers:headers(key,{Prefer:'return=minimal'}),body:JSON.stringify({data,updated_at:new Date().toISOString()})});
      if(!r.ok){const x=await r.text();throw new Error(x||'Database update failed');}
      return json(res,200,{projectId,updated:true});
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return json(res,500,{error:e.message||'Server error'});}
};
