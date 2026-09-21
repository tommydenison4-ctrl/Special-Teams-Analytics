(function(){
'use strict';
const V='20260921-live1';
const DATA='/fau/data/';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function getText(name){const r=await fetch(DATA+name+'?v='+V,{cache:'no-store'});if(!r.ok)throw new Error(name+' '+r.status);return r.text();}
async function getJson(name){const r=await fetch(DATA+name+'?v='+V,{cache:'no-store'});if(!r.ok)throw new Error(name+' '+r.status);return r.json();}
function isReady(){return typeof parseCSV==='function'&&typeof setup==='function'&&typeof render==='function';}
function chooseFau(){
  try{prepOpponent='FAU';}catch(_){}
  try{localStorage.setItem('stPrepOpponentV1','FAU');}catch(_){}
  try{teamSettings={...teamSettings,teamName:'Florida Atlantic',nickname:'Owls',teamCode:'FLAT',rosterUrl:'https://fausports.com/sports/football/roster',season:'2026'};}catch(_){}
}
async function loadLocalPrep(options={}){
  chooseFau();
  const [pkg,depth]=await Promise.all([getJson('roster.json'),getJson('depth-chart.json')]);
  const players=Array.isArray(pkg)?pkg:(Array.isArray(pkg.players)?pkg.players:[]);
  prepRosterData=players.map(p=>({...p}));
  prepDepthChart=depth;
  if(typeof prepCache!=='undefined'&&prepCache)prepCache.FAU={roster:prepRosterData,depth:prepDepthChart};
  rosterData=prepRosterData.map(p=>{try{return typeof enrichPrepPlayer==='function'?enrichPrepPlayer(p):p}catch(_){return p}});
  if(typeof prepLoadStatus!=='undefined')prepLoadStatus='Florida Atlantic Week 4 loaded • '+prepRosterData.length+' player profiles';
  if(typeof updatePrepStatus==='function')updatePrepStatus();
  if(options.render!==false&&typeof render==='function')render();
  return true;
}
async function loadLocalPff(options={}){
  chooseFau();
  const [off,def,kicks]=await Promise.all([getText('offensive-side.csv'),getText('defensive-side.csv'),getText('official-fg-pat.csv')]);
  const groups=[parseCSV(off),parseCSV(def),parseCSV(kicks)];
  rows=typeof mergePffSources==='function'?mergePffSources(groups):groups.flat();
  if(typeof setup==='function')setup();
  try{const el=document.getElementById('teamF');if(el&&[...el.options].some(o=>o.value==='FLAT'))el.value='FLAT';}catch(_){}
  if(typeof setDataSourceStatus==='function')setDataSourceStatus('Florida Atlantic • Week 4 LIVE • 48 uploaded PFF rows + 15 official FG/PAT rows • '+rows.length+' total events');
  if(options.render!==false&&typeof render==='function')render();
  return true;
}
async function install(){
  for(let i=0;i<100&&!isReady();i++)await wait(50);
  if(!isReady())throw new Error('Special Teams engine did not initialize');
  chooseFau();
  const oldPrep=typeof loadPrepOpponentData==='function'?loadPrepOpponentData:null;
  const oldPff=typeof loadPffFromSupabase==='function'?loadPffFromSupabase:null;
  loadPrepOpponentData=async function(options={}){if(prepOpponent==='FAU')return loadLocalPrep(options);return oldPrep?oldPrep(options):false;};
  loadPffFromSupabase=async function(options={}){if(prepOpponent==='FAU')return loadLocalPff(options);return oldPff?oldPff(options):false;};
  await loadLocalPrep({render:false});
  await loadLocalPff({render:false});
  if(typeof setup==='function')setup();
  try{const el=document.getElementById('teamF');if(el&&[...el.options].some(o=>o.value==='FLAT'))el.value='FLAT';}catch(_){}
  if(typeof render==='function')render();
}
install().catch(err=>{
  console.error('FAU live patch failed',err);
  try{if(typeof setDataSourceStatus==='function')setDataSourceStatus('Florida Atlantic live data failed: '+err.message,true);}catch(_){}
});
})();
