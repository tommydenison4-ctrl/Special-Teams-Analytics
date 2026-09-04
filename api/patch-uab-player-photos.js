const BUCKET = 'Special Teams';
const OBJECT_PATH = 'Opponents/UAB/roster.json';

const PHOTO_MAP = {
  'cj smith': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/5/7/CJ_MpaHI.jpg',
  'ike esonwune': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/4/18/060A7971_LnuPq.jpg',
  'jaylen thompson': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/7/9/Thompson_Jaylen_aMTgj.jpg',
  'cam cunningham': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/5/7/Cam_Cunningham_RIePt.jpg',
  'blanche gold': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/5/7/Blanche_Gold_uIU1v.jpg',
  'marquise collins': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/7/9/Collins_Marquise_5PBXA.jpg',
  'que billingsley': 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/uabsports.com/images/2026/5/7/Que_Billingsley_hJryq.jpg'
};

function send(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}

function normalizeName(value){
  return String(value||'').toLowerCase().replace(/[“”"'’.,()]/g,'').replace(/\s+/g,' ').trim();
}

function env(){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Missing Supabase server credentials.');
  return {url,key};
}

function objectUrl(base){
  const bucket=encodeURIComponent(BUCKET);
  const path=OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/${bucket}/${path}`;
}

export default async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed.'});
  try{
    const {url,key}=env();
    const target=objectUrl(url);
    const read=await fetch(`${target}?v=${Date.now()}`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'
    });
    if(!read.ok)throw new Error(`Could not read UAB roster (${read.status}).`);
    const data=await read.json();
    const players=Array.isArray(data)?data:(Array.isArray(data.players)?data.players:[]);
    if(!players.length)throw new Error('UAB roster contains no players.');

    const updated=[];
    const missing=[];
    for(const [name,image] of Object.entries(PHOTO_MAP)){
      const player=players.find(p=>normalizeName(p.name)===name);
      if(!player){missing.push(name);continue;}
      player.image=image;
      player.imageSource='UAB official roster/profile';
      player.imageVerifiedAt=new Date().toISOString();
      updated.push(player.name);
    }

    const payload=Array.isArray(data)?JSON.stringify(players):JSON.stringify({...data,players,enrichedAt:new Date().toISOString(),count:players.length});
    const write=await fetch(target,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json; charset=utf-8','x-upsert':'true','cache-control':'0'},
      body:payload
    });
    if(!write.ok){const detail=await write.text();throw new Error(`Could not save UAB roster (${write.status}): ${detail}`);}

    return send(res,200,{ok:true,total:players.length,updatedCount:updated.length,updated,missing});
  }catch(error){
    return send(res,500,{error:error?.message||'UAB photo patch failed.'});
  }
}
