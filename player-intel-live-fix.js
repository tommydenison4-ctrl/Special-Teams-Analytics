(function(){
  'use strict';

  function h(value){
    return String(value==null?'':value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Southeastern's public Storage depth-chart URL can return HTTP 400 in the browser.
  // Route the two JSON prep files through the existing /api/sela function instead.
  if(typeof prepPublicUrl==='function'){
    const originalPrepPublicUrl=prepPublicUrl;
    prepPublicUrl=function(path){
      const value=String(path||'');
      try{
        if(typeof prepOpponent!=='undefined'&&prepOpponent==='SELA'){
          if(/(^|\/)roster\.json$/i.test(value))return '/api/sela?route=roster&v='+Date.now();
          if(/(^|\/)depth-chart\.json$/i.test(value))return '/api/sela?route=depth&v='+Date.now();
        }
      }catch(_){}
      return originalPrepPublicUrl(path);
    };
  }

  if(typeof playerPhoto==='function'){
    const originalPlayerPhoto=playerPhoto;
    playerPhoto=function(p){
      if(!p||!p.image)return originalPlayerPhoto(p);
      const original=String(p.image||'').trim();
      if(!original)return originalPlayerPhoto(p);
      const proxy='/api/player-image?url='+encodeURIComponent(original);
      const alt=h(p.name||'Player');
      const originalAttr=h(original);
      return '<img src="'+proxy+'" data-original="'+originalAttr+'" alt="'+alt+'" onerror="if(!this.dataset.triedOriginal){this.dataset.triedOriginal=\'1\';this.src=this.dataset.original}else{this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'}"><div class="playerInitials" style="display:none">'+initials(p&&p.name)+'</div>';
    };
  }

  if(typeof playerPage!=='function')return;
  const originalPlayerPage=playerPage;

  function currentOpponentActive(){
    try{return typeof prepOpponent!=='undefined'&&prepOpponent&&prepOpponent!=='MSST'&&typeof prepDepthPlayerNamesForCategory==='function'&&prepDepthChart;}
    catch(_){return false;}
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

  function sameName(a,b){
    try{return nameKey(a||'')===nameKey(b||'');}
    catch(_){return String(a||'').toLowerCase().trim()===String(b||'').toLowerCase().trim();}
  }

  function combinedCurrentPlayers(a,cat){
    const depthPlayers=(prepDepthPlayerNamesForCategory(cat)||[]).slice();
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
    const p=x.p||{};
    const role=p.depthRole||'ST';
    let stats=[[role,'DEPTH'],[p.position||'—','POS'],[p.class||'—','CLASS']];
    if(cat==='kickers')stats=[[role,'DEPTH'],['—','FG'],['—','FG%']];
    if(cat==='punters')stats=[[role,'DEPTH'],['—','Punts'],['—','Gross']];
    return '<div class="playerSelect" data-playernum="'+h(x.num||p.number||'')+'">'+playerCard(p,stats,p.name||'Current opponent player',null)+'</div>';
  }

  playerPage=function(a){
    try{
      if(!currentOpponentActive())return originalPlayerPage(a);

      // Coverage-tackler pages are actual tackle-result lists, so leave those alone.
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
          const current=list.map(function(x){return x.p;});
          detail=prepSelectedProfile(current);
        }
      }

      return reportBanner('Player Intelligence')+
        title('Player Intelligence',opponent+' current special-teams depth chart with available PFF performance attached to the same player. Current roster players remain visible even when they have no qualifying PFF rep in the loaded files.')+
        '<div class="card"><div class="context">Active team: <b>'+h((typeof selectedTeam==='function'&&selectedTeam())||'')+'</b>. '+h(opponent)+' roster loaded: <b>'+rosterCount+'</b> players. Current depth-chart identity now controls the player cards.</div></div>'+
        categoryTabs()+
        '<div class="card"><div class="eyebrow">'+h(label)+'</div><div class="playerCardGrid" style="margin-top:10px">'+cards+'</div></div>'+
        '<div style="margin-top:14px">'+detail+'</div>';
    }catch(error){
      console.error('Current opponent Player Intelligence patch failed:',error);
      return originalPlayerPage(a);
    }
  };

  // The base app may have already attempted the public depth-chart URL before this
  // patch loaded. Force one clean Week 3 reload so depth chart + roster are available
  // immediately and the current-player Player Intelligence renderer takes over.
  try{
    if(typeof prepOpponent!=='undefined'&&prepOpponent==='SELA'&&typeof loadPrepOpponentData==='function'){
      if(typeof prepCache!=='undefined'&&prepCache)delete prepCache.SELA;
      setTimeout(function(){
        try{
          Promise.resolve(loadPrepOpponentData({render:true})).catch(function(error){
            console.error('SELA prep API reload failed:',error);
          });
        }catch(error){console.error('SELA prep API reload failed:',error);}
      },50);
    }
  }catch(error){console.error('SELA prep reload setup failed:',error);}
})();
