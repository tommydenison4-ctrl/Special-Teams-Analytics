(function(){
  'use strict';

  function h(value){
    return String(value==null?'':value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function localNameKey(value){
    return String(value||'').toLowerCase().replace(/[“”"'’.,()]/g,'').replace(/\s+/g,' ').trim();
  }

  const SELA_DEPTH={
    team:'Southeastern Louisiana',
    season:2026,
    week:3,
    source:'2026 Southeastern Louisiana Football Game Notes',
    updated:'2026-09-13',
    specialTeams:{
      PT:[['46','Jack Hunter','Sr.'],['28','Aiden Parker','So.']],
      PK:[['29','Drew Talley','So.'],['27','Owen Wiley','Jr.']],
      KO:[['27','Owen Wiley','Jr.'],['29','Drew Talley','So.']],
      LS:[['41','Shawn Puissegur','So.'],['13','Conner Nelson','So.']],
      H:[['46','Jack Hunter','Sr.']],
      KR:[['2','Kyree Paul','So.'],['4','Tristan Goodly','Sr.']],
      PR:[['9','Dkhai Joseph','Jr.'],['82','Desmen Jefferson','Fr.'],['19','Blake Smith','Fr.']]
    }
  };

  const SELA_PROFILES={
    'kyree paul':'https://lionsports.net/sports/football/roster/kyree-paul/11721',
    'tristan goodly':'https://lionsports.net/sports/football/roster/tristan-goodly/11699',
    'dkhai joseph':'https://lionsports.net/sports/football/roster/dkhai-joseph/11710',
    'conner nelson':'https://lionsports.net/sports/football/roster/conner-nelson/11719',
    'blake smith':'https://lionsports.net/sports/football/roster/blake-smith/11874',
    'owen wiley':'https://lionsports.net/sports/football/roster/owen-wiley/11876',
    'aiden parker':'https://lionsports.net/sports/football/roster/aiden-parker/11780',
    'drew talley':'https://lionsports.net/sports/football/roster/drew-talley/11733',
    'shawn puissegur':'https://lionsports.net/sports/football/roster/shawn-puissegur/11875',
    'jack hunter':'https://lionsports.net/sports/football/roster/jack-hunter/11706',
    'desmen jefferson':'https://lionsports.net/sports/football/roster/desmen-jefferson/11896'
  };

  function isSela(){
    try{return typeof prepOpponent!=='undefined'&&prepOpponent==='SELA';}
    catch(_){return false;}
  }

  function enrichSelaPlayer(p){
    if(!p||!isSela())return p;
    const profile=SELA_PROFILES[localNameKey(p.name)];
    return profile&&!p.profile?Object.assign({},p,{profile}):p;
  }

  function applySelaDepth(){
    if(!isSela())return false;
    try{
      prepDepthChart=SELA_DEPTH;
      if(typeof prepLoadStatus!=='undefined')prepLoadStatus='Southeastern Louisiana published 2026 special-teams depth loaded';
      if(typeof prepCache!=='undefined'&&prepCache){
        const roster=(typeof prepRosterData!=='undefined'&&Array.isArray(prepRosterData))?prepRosterData:[];
        prepCache.SELA={roster:roster,depth:SELA_DEPTH};
      }
      if(typeof updatePrepStatus==='function')updatePrepStatus();
      return true;
    }catch(error){
      console.error('SELA fixed depth install failed:',error);
      return false;
    }
  }

  // Never depend on the Week 3 Storage depth-chart object. The published chart is
  // embedded above; only the roster needs to be read from the server.
  if(typeof loadPrepOpponentData==='function'){
    const originalLoadPrepOpponentData=loadPrepOpponentData;
    loadPrepOpponentData=async function(options={}){
      if(!isSela())return originalLoadPrepOpponentData(options);
      try{localStorage.setItem('stPrepOpponentV1','SELA');}catch(_){}
      applySelaDepth();
      try{
        const response=await fetch('/api/sela?route=roster&v='+Date.now(),{cache:'no-store'});
        if(response.ok){
          const data=await response.json();
          const parsed=Array.isArray(data)?data:(Array.isArray(data.players)?data.players:[]);
          if(parsed.length){
            prepRosterData=parsed.map(enrichSelaPlayer);
            rosterData=prepRosterData.map(function(p){
              try{return enrichSelaPlayer(typeof enrichPrepPlayer==='function'?enrichPrepPlayer(p):p);}
              catch(_){return enrichSelaPlayer(p);}
            });
          }
        }else{
          console.warn('SELA roster endpoint returned',response.status,'; keeping already loaded roster.');
        }
      }catch(error){
        console.warn('SELA roster refresh failed; keeping already loaded roster.',error);
      }
      applySelaDepth();
      if(typeof prepCache!=='undefined'&&prepCache){
        prepCache.SELA={roster:(typeof prepRosterData!=='undefined'&&prepRosterData)||[],depth:SELA_DEPTH};
      }
      if(typeof prepLoadStatus!=='undefined')prepLoadStatus='Southeastern Louisiana prep loaded • '+(((typeof prepRosterData!=='undefined'&&prepRosterData)||[]).length||0)+' roster players';
      if(typeof updatePrepStatus==='function')updatePrepStatus();
      if(options.render&&typeof render==='function')render();
      return true;
    };
  }

  // Ensure any view that uses prepDepthChart sees the published chart, even if an
  // earlier in-flight Storage request failed after this patch loaded.
  if(typeof opponentDepthChartPage==='function'){
    const originalOpponentDepthChartPage=opponentDepthChartPage;
    opponentDepthChartPage=function(){
      if(isSela())applySelaDepth();
      return originalOpponentDepthChartPage();
    };
  }

  if(typeof prepDepthPlayerNamesForCategory==='function'){
    const originalPrepDepthPlayerNamesForCategory=prepDepthPlayerNamesForCategory;
    prepDepthPlayerNamesForCategory=function(cat){
      if(isSela())applySelaDepth();
      return (originalPrepDepthPlayerNamesForCategory(cat)||[]).map(enrichSelaPlayer);
    };
  }

  // Photos use a direct URL when the roster already has one. For the older 105-player
  // Week 3 roster, the official profile URL is enough: /api/player-image extracts the
  // current Lions headshot server-side and serves it from our own origin.
  if(typeof playerPhoto==='function'){
    const originalPlayerPhoto=playerPhoto;
    playerPhoto=function(rawPlayer){
      const p=enrichSelaPlayer(rawPlayer);
      if(!p)return originalPlayerPhoto(p);
      const original=String(p.image||'').trim();
      const profile=String(p.profile||'').trim();
      if(!original&&!profile)return originalPlayerPhoto(p);
      const primary=original?'/api/player-image?url='+encodeURIComponent(original):'/api/player-image?profile='+encodeURIComponent(profile);
      const fallback=original&&profile?'/api/player-image?profile='+encodeURIComponent(profile):'';
      const alt=h(p.name||'Player');
      const originalAttr=h(original);
      const fallbackAttr=h(fallback);
      return '<img src="'+primary+'" data-original="'+originalAttr+'" data-profile-fallback="'+fallbackAttr+'" alt="'+alt+'" onerror="if(this.dataset.profileFallback&&!this.dataset.triedProfile){this.dataset.triedProfile=\'1\';this.src=this.dataset.profileFallback}else if(this.dataset.original&&!this.dataset.triedOriginal){this.dataset.triedOriginal=\'1\';this.src=this.dataset.original}else{this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'}"><div class="playerInitials" style="display:none">'+initials(p&&p.name)+'</div>';
    };
  }

  if(typeof playerPage!=='function'){
    applySelaDepth();
    return;
  }
  const originalPlayerPage=playerPage;

  function currentOpponentActive(){
    try{
      if(isSela())applySelaDepth();
      return typeof prepOpponent!=='undefined'&&prepOpponent&&prepOpponent!=='MSST'&&typeof prepDepthPlayerNamesForCategory==='function'&&prepDepthChart;
    }catch(_){return false;}
  }

  function pffListForCategory(a,cat){
    if(cat==='kickReturners')return returnerFullStats(a,'KICKOFF');
    if(cat==='puntReturners')return returnerFullStats(a,'PUNT');
    if(cat==='kickers')return specialistFullStats(a,'kicker');
    if(cat==='punters')return specialistFullStats(a,'punter');
    if(cat==='koCoverageTacklers')return kickoffTacklerStats(a,'coverage');
    if(cat==='puntTeamTacklers')return puntTacklerStats(a);
    return [];
  }

  function sameName(a,b){return localNameKey(a)===localNameKey(b);}

  function combinedCurrentPlayers(a,cat){
    const depthPlayers=(prepDepthPlayerNamesForCategory(cat)||[]).map(enrichSelaPlayer);
    const pff=pffListForCategory(a,cat)||[];
    return depthPlayers.map(function(p){
      let match=pff.find(function(x){return x&&x.p&&sameName(x.p.name,p.name);});
      if(!match&&p.number){
        match=pff.find(function(x){
          if(String(x&&x.num||'')!==String(p.number||''))return false;
          const xp=x&&x.p;
          return !xp||!xp.name||sameName(xp.name,p.name);
        });
      }
      if(match){
        return Object.assign({},match,{num:String(p.number||match.num||''),p:Object.assign({},p),_currentDepth:true});
      }
      return {num:String(p.number||''),p:Object.assign({},p),rows:[],verification:{status:'verified',allowed:true},_currentDepth:true,_depthOnly:true};
    });
  }

  function depthOnlyCard(x,cat){
    const p=enrichSelaPlayer(x.p||{});
    const role=p.depthRole||'ST';
    let stats=[[role,'DEPTH'],[p.position||'—','POS'],[p.class||'—','CLASS']];
    if(cat==='kickers')stats=[[role,'DEPTH'],['—','FG'],['—','FG%']];
    if(cat==='punters')stats=[[role,'DEPTH'],['—','Punts'],['—','Gross']];
    return '<div class="playerSelect" data-playernum="'+h(x.num||p.number||'')+'">'+playerCard(p,stats,p.name||'Current opponent player',null)+'</div>';
  }

  playerPage=function(a){
    try{
      if(isSela())applySelaDepth();
      if(!currentOpponentActive())return originalPlayerPage(a);

      // Coverage-tackler pages are result-based PFF lists rather than published depth.
      if(playerCategory==='koCoverageTacklers'||playerCategory==='puntTeamTacklers'){
        return originalPlayerPage(a);
      }

      const list=combinedCurrentPlayers(a,playerCategory);
      const labels={kickReturners:'Kick Returners',puntReturners:'Punt Returners',kickers:'Kickers / Kickoff',punters:'Punters'};
      const label=labels[playerCategory]||'Current Special Teams Players';
      const opponent=(typeof prepConfig==='function'&&prepConfig().label)||'Opponent';
      const rosterCount=(typeof rosterData!=='undefined'&&rosterData&&rosterData.length)||0;
      const cards=list.length?list.map(function(x){return x._depthOnly?depthOnlyCard(x,playerCategory):cardForCategory(x,playerCategory);}).join(''):'<div class="empty">No current depth-chart players are listed in this category.</div>';

      let detail='<div class="empty">No current depth-chart player is selected.</div>';
      if(list.length){
        if(!selectedSpecialist||!list.some(function(x){return String(x.num)===String(selectedSpecialist);})){selectedSpecialist=String(list[0].num||'');}
        try{detail=selectedProfile(a,playerCategory,list);}catch(_){
          const current=list.map(function(x){return enrichSelaPlayer(x.p);});
          detail=prepSelectedProfile(current);
        }
      }

      return reportBanner('Player Intelligence')+
        title('Player Intelligence',opponent+' published 2026 special-teams depth with available PFF performance attached to the same current player.')+
        '<div class="card"><div class="context">Active team: <b>'+h((typeof selectedTeam==='function'&&selectedTeam())||'')+'</b>. '+h(opponent)+' roster loaded: <b>'+rosterCount+'</b> players. Published Week 3 depth controls these player cards.</div></div>'+
        categoryTabs()+
        '<div class="card"><div class="eyebrow">'+h(label)+'</div><div class="playerCardGrid" style="margin-top:10px">'+cards+'</div></div>'+
        '<div style="margin-top:14px">'+detail+'</div>';
    }catch(error){
      console.error('Current opponent Player Intelligence patch failed:',error);
      return originalPlayerPage(a);
    }
  };

  // Install immediately, then reload only the roster. Re-apply once more after the
  // original startup request has had time to settle so an old 400 cannot null the chart.
  try{
    if(isSela()){
      applySelaDepth();
      setTimeout(function(){
        try{Promise.resolve(loadPrepOpponentData({render:true})).catch(function(error){console.error('SELA prep reload failed:',error);});}
        catch(error){console.error('SELA prep reload failed:',error);}
      },75);
      setTimeout(function(){
        try{applySelaDepth();if(typeof render==='function')render();}catch(_){}
      },900);
    }
  }catch(error){console.error('SELA prep setup failed:',error);}
})();
