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

  function opponentKey(value){
    return String(value==null?'':value).toLowerCase().replace(/[^a-z0-9]/g,'');
  }

  const SELA_DEPTH={
    team:'Southeastern Louisiana',
    season:2026,
    week:3,
    source:'2026 Southeastern Louisiana Football Game Notes',
    updated:'2026-08-31',
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

  // Exact special-teams two-deep used by the Command Center Southeastern Louisiana tab.
  const SELA_DEPTH_ROWS=[
    ['PK',[['29','Drew Talley','So.'],['27','Owen Wiley','Jr.']]],
    ['KO',[['27','Owen Wiley','Jr.'],['29','Drew Talley','So.']]],
    ['P',[['46','Jack Hunter','Sr.'],['28','Aiden Parker','So.']]],
    ['LS',[['41','Shawn Puissegur','So.'],['13','Conner Nelson','So.']]],
    ['HOLD',[['46','Jack Hunter','Sr.']]],
    ['KR',[['2','Kyree Paul','So.'],['4','Tristan Goodly','Sr.']]],
    ['PR',[['9','Dkhai Joseph','Jr.'],['82','Desmen Jefferson','Fr.'],['19','Blake Smith','Fr.']]]
  ];

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

  // Official 2026 cumulative punting is a fallback only when the loaded PFF
  // package has no usable PUNT rows for the current published punter.
  // Source snapshot: lionsports.net 2026 cumulative stats through South Alabama (2 games).
  const SELA_PUNTER_OFFICIAL={
    'jack hunter':{
      punts:5,yards:206,gross:41.2,long:70,touchbacks:0,fairCatches:1,inside20:2,fiftyPlus:1,blocked:0,
      opponentReturns:1,opponentReturnYards:5,net:40.2,
      source:'Official Southeastern Louisiana 2026 cumulative stats through South Alabama (2 games)'
    }
  };

  function isSela(){
    const values=[];
    try{if(typeof prepOpponent!=='undefined')values.push(prepOpponent);}catch(_){}
    try{
      if(typeof prepConfig==='function'){
        const cfg=prepConfig()||{};
        values.push(cfg.key,cfg.code,cfg.teamCode,cfg.label,cfg.name,cfg.teamName,cfg.opponent);
      }
    }catch(_){}
    try{
      const ws=window.__ULM_SPECIAL_TEAMS_WORKSPACE__||{};
      values.push(ws.opponent,ws.rawTeamCode,ws.sourcePackage);
    }catch(_){}
    try{
      values.push(localStorage.getItem('stPrepOpponentV1'));
      values.push(sessionStorage.getItem('stPrepOpponentV1'));
    }catch(_){}
    return values.some(function(value){
      const key=opponentKey(value);
      return key==='sela'||key==='lase'||key==='southeastern'||key==='southeasternla'||key.indexOf('southeasternlouisiana')>=0||key.indexOf('southeasternla')>=0;
    });
  }

  function enrichSelaPlayer(p){
    if(!p||!isSela())return p;
    const profile=SELA_PROFILES[localNameKey(p.name)];
    return profile&&!p.profile?Object.assign({},p,{profile:profile}):p;
  }

  function selaRolesForCategory(cat){
    if(cat==='kickReturners')return ['KR'];
    if(cat==='puntReturners')return ['PR'];
    if(cat==='kickers')return ['PK','KO'];
    if(cat==='punters')return ['PT'];
    if(cat==='depthChart')return ['PT','PK','KO','LS','H','KR','PR'];
    return [];
  }

  function selaDepthPlayersForCategory(cat){
    const roles=selaRolesForCategory(cat);
    if(!roles.length)return [];
    const st=SELA_DEPTH.specialTeams||{};
    let roster=[];
    try{roster=(typeof prepRosterData!=='undefined'&&Array.isArray(prepRosterData))?prepRosterData:[];}catch(_){}
    const seen={};
    const out=[];
    roles.forEach(function(role){
      (Array.isArray(st[role])?st[role]:[]).forEach(function(entry){
        const num=String(entry&&entry[0]!=null?entry[0]:'');
        const name=String(entry&&entry[1]!=null?entry[1]:'');
        const klass=String(entry&&entry[2]!=null?entry[2]:'');
        if(!name)return;
        const key=localNameKey(name)||('num:'+num);
        if(seen[key]){
          if(seen[key]._depthRoles.indexOf(role)<0)seen[key]._depthRoles.push(role);
          seen[key].depthRole=seen[key]._depthRoles.join(' / ');
          return;
        }
        let base=roster.find(function(r){return r&&localNameKey(r.name)===localNameKey(name);});
        if(!base&&num)base=roster.find(function(r){return r&&String(r.number||'')===num&&(!r.name||localNameKey(r.name)===localNameKey(name));});
        const player=enrichSelaPlayer(Object.assign({},base||{}, {
          name:(base&&base.name)||name,
          number:(base&&base.number)||num,
          class:(base&&base.class)||klass,
          _depthRoles:[role],
          depthRole:role,
          currentRoster:true
        }));
        seen[key]=player;
        out.push(player);
      });
    });
    return out;
  }

  function applySelaDepth(){
    if(!isSela())return false;
    try{
      prepDepthChart=SELA_DEPTH;
      if(typeof prepLoadStatus!=='undefined')prepLoadStatus='Southeastern Louisiana 2026 special-teams depth loaded';
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

  // The root app can store Southeastern Louisiana under several different keys.
  // Once any of those keys are active, bypass the old opponent loader and install
  // the same depth chart used by Command Center.
  if(typeof loadPrepOpponentData==='function'){
    const originalLoadPrepOpponentData=loadPrepOpponentData;
    loadPrepOpponentData=async function(options={}){
      if(!isSela())return originalLoadPrepOpponentData(options);
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

  function selaDepthChartPage(){
    const heads=['1ST','2ND','3RD','ADDITIONAL'];
    const rows=SELA_DEPTH_ROWS.map(function(row){
      const pos=row[0],players=row[1]||[];
      const cells=heads.map(function(_,i){
        const p=players[i];
        if(!p)return '<td style="padding:12px;border-top:1px solid #29404b;color:#6f8793">—</td>';
        return '<td style="padding:12px;border-top:1px solid #29404b"><b style="color:#f6c74f">#'+h(p[0])+'</b> '+h(p[1])+(p[2]?' <span style="color:#8298a5">('+h(p[2])+')</span>':'')+'</td>';
      }).join('');
      return '<tr><td style="padding:12px;border-top:1px solid #29404b;font-weight:900;color:#fff">'+h(pos)+'</td>'+cells+'</tr>';
    }).join('');
    const banner=(typeof reportBanner==='function')?reportBanner('Opponent ST Depth Chart'):'';
    const heading=(typeof title==='function')?title('Opponent ST Depth Chart','Southeastern Louisiana • 2026 Week 3 • Command Center depth chart'):('<h2>Opponent ST Depth Chart</h2>');
    return banner+heading+
      '<div class="card" style="overflow:hidden"><div class="eyebrow">SOUTHEASTERN LOUISIANA SPECIAL TEAMS</div>'+
      '<div style="margin-top:8px;color:#9bb0bb;font-size:12px">Source: '+h(SELA_DEPTH.source)+' • Updated '+h(SELA_DEPTH.updated)+'</div>'+
      '<div style="overflow-x:auto;margin-top:14px"><table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr><th style="text-align:left;padding:12px;color:#f6c74f">POS</th>'+heads.map(function(x){return '<th style="text-align:left;padding:12px;color:#f6c74f">'+x+'</th>';}).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }

  // Do not rely on the base depth page for SELA. Render the exact Command Center
  // two-deep directly so a stale Supabase depth object cannot leave this page blank.
  if(typeof opponentDepthChartPage==='function'){
    const originalOpponentDepthChartPage=opponentDepthChartPage;
    opponentDepthChartPage=function(){
      if(!isSela())return originalOpponentDepthChartPage();
      applySelaDepth();
      return selaDepthChartPage();
    };
  }

  // The dedicated /southeastern/ workspace still calls the original Week 1
  // depth renderer name. Override that renderer too so its sidebar depth page uses
  // the exact Command Center Southeastern Louisiana two-deep.
  if(typeof week1DepthChartPage==='function'){
    const originalWeek1DepthChartPage=week1DepthChartPage;
    week1DepthChartPage=function(){
      if(!isSela())return originalWeek1DepthChartPage();
      applySelaDepth();
      return selaDepthChartPage();
    };
  }

  if(typeof prepDepthPlayerNamesForCategory==='function'){
    const originalPrepDepthPlayerNamesForCategory=prepDepthPlayerNamesForCategory;
    prepDepthPlayerNamesForCategory=function(cat){
      if(!isSela())return originalPrepDepthPlayerNamesForCategory(cat)||[];
      applySelaDepth();
      const fixed=selaDepthPlayersForCategory(cat);
      return fixed.length?fixed:(originalPrepDepthPlayerNamesForCategory(cat)||[]).map(enrichSelaPlayer);
    };
  }

  function localInitials(name){
    try{if(typeof initials==='function')return initials(name);}catch(_){}
    return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase();
  }

  function imageFallbackForPlayer(p){
    const original=String(p&&p.image||'').trim();
    if(original){
      if(/^\/api\//i.test(original))return original;
      if(/^https:\/\//i.test(original))return '/api/player-image?url='+encodeURIComponent(original);
    }
    const profile=String(p&&p.profile||'').trim();
    if(profile)return '/api/player-image?profile='+encodeURIComponent(profile);
    return '';
  }

  // Defensive Intelligence already proved that resolving a Southeastern portrait by
  // player name against the official Lions roster is reliable. Use that same method
  // here instead of trusting stale image URLs or double-wrapping /api/player-image URLs.
  if(typeof playerPhoto==='function'){
    const originalPlayerPhoto=playerPhoto;
    playerPhoto=function(rawPlayer){
      if(!isSela())return originalPlayerPhoto(rawPlayer);
      const p=enrichSelaPlayer(rawPlayer||{});
      const name=String(p&&p.name||'').trim();
      if(!name)return originalPlayerPhoto(p);
      const primary='/api/player-image?name='+encodeURIComponent(name)+'&hq=20260914c';
      const fallback=imageFallbackForPlayer(p);
      return '<img src="'+h(primary)+'" data-fallback="'+h(fallback)+'" alt="'+h(name)+'" loading="lazy" onerror="if(this.dataset.fallback&&!this.dataset.triedFallback){this.dataset.triedFallback=\'1\';this.src=this.dataset.fallback}else{this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'block\'}"><div class="playerInitials" style="display:none">'+h(localInitials(name))+'</div>';
    };
  }

  if(typeof playerPage!=='function'){
    applySelaDepth();
    return;
  }
  const originalPlayerPage=playerPage;

  function currentOpponentActive(){
    try{
      if(isSela()){
        applySelaDepth();
        return true;
      }
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
          if(isSela())return true;
          const xp=x&&x.p;
          return !xp||!xp.name||sameName(xp.name,p.name);
        });
      }
      if(match&&Array.isArray(match.rows)&&match.rows.length){
        return Object.assign({},match,{num:String(p.number||match.num||''),p:Object.assign({},p),_currentDepth:true});
      }
      if(isSela()&&cat==='punters'){
        const official=SELA_PUNTER_OFFICIAL[localNameKey(p.name)];
        if(official){
          return {num:String(p.number||''),p:Object.assign({},p),rows:[],verification:{status:'verified',allowed:true},_currentDepth:true,_officialPunter:official};
        }
      }
      return {num:String(p.number||''),p:Object.assign({},p),rows:[],verification:{status:'verified',allowed:true},_currentDepth:true,_depthOnly:true};
    });
  }

  function officialPunterCard(x){
    const p=enrichSelaPlayer(x.p||{}),st=x._officialPunter||{};
    const stats=[['Punts',st.punts??'—'],['Gross',st.gross!=null?Number(st.gross).toFixed(1):'—'],['Long',st.long??'—']];
    return '<div class="playerSelect" data-playernum="'+h(x.num||p.number||'')+'">'+playerCard(p,stats,p.name||'Current opponent punter',x.verification||null)+'</div>';
  }

  function officialPunterProfile(x){
    const p=enrichSelaPlayer(x.p||{}),st=x._officialPunter||{};
    const fcPct=st.punts?((100*Number(st.fairCatches||0)/st.punts).toFixed(1)+'%'):'—';
    const tbPct=st.punts?((100*Number(st.touchbacks||0)/st.punts).toFixed(1)+'%'):'—';
    const i20Pct=st.punts?((100*Number(st.inside20||0)/st.punts).toFixed(1)+'%'):'—';
    const metrics=[
      ['Punts',st.punts??'—'],['Gross',st.gross!=null?Number(st.gross).toFixed(1):'—'],['Net*',st.net!=null?Number(st.net).toFixed(1):'—'],['Long',st.long??'—'],
      ['Hang','—'],['Operation','—'],['Fair catch %',fcPct],['Touchback %',tbPct],['Inside 20 %',i20Pct],['50+',st.fiftyPlus??'—'],['Blocked',st.blocked??'—'],['Return yds allowed',st.opponentReturnYards??'—']
    ];
    const meta=[p.position,[p.height,p.weight&&p.weight+' lbs'].filter(Boolean).join(' · '),p.class,p.hometown].filter(Boolean).join(' • ');
    const bio=p.bio?'<div style="margin-top:10px;color:#c6d4dc;font-size:12px;line-height:1.45">'+h(p.bio)+'</div>':'';
    const profile=p.profile?'<a class="profileLink" href="'+h(p.profile)+'" target="_blank" rel="noopener">Official biography ↗</a>':'';
    return '<div class="card"><div style="display:grid;grid-template-columns:minmax(170px,220px) 1fr;gap:18px;align-items:start">'+
      '<div class="playerPhoto" style="height:260px">'+playerPhoto(p)+'<div class="playerNo">#'+h(p.number||x.num||'—')+'</div></div>'+
      '<div><div class="eyebrow">PLAYER PROFILE</div><h2 style="margin:4px 0 5px">'+h(p.name||'Jack Hunter')+'</h2><div class="playerMeta">'+h(meta)+'</div>'+bio+profile+
      '<div class="metrics" style="margin-top:14px">'+metrics.map(function(z){return '<div class="mini"><b>'+h(z[1])+'</b><span>'+h(z[0])+'</span></div>';}).join('')+'</div>'+
      '<div class="note" style="margin-top:12px">'+h(st.source||'Official Southeastern Louisiana cumulative stats')+'. PFF punt rows are not usable in the current package, so official current totals are shown. *Net is derived from 206 punt yards, 5 opponent return yards and 0 touchbacks. Hang and operation remain blank rather than being estimated.</div></div></div></div>';
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

      // Coverage-tackler pages are PFF result lists rather than published two-deep roles.
      if(playerCategory==='koCoverageTacklers'||playerCategory==='puntTeamTacklers'){
        return originalPlayerPage(a);
      }

      const list=combinedCurrentPlayers(a,playerCategory);
      const labels={kickReturners:'Kick Returners',puntReturners:'Punt Returners',kickers:'Kickers / Kickoff',punters:'Punters'};
      const label=labels[playerCategory]||'Current Special Teams Players';
      let opponent='Opponent';
      try{opponent=(typeof prepConfig==='function'&&prepConfig().label)||opponent;}catch(_){}
      if(isSela())opponent='Southeastern Louisiana';
      const rosterCount=(typeof rosterData!=='undefined'&&rosterData&&rosterData.length)||0;
      const cards=list.length?list.map(function(x){return x._officialPunter?officialPunterCard(x):x._depthOnly?depthOnlyCard(x,playerCategory):cardForCategory(x,playerCategory);}).join(''):'<div class="empty">No current depth-chart players are listed in this category.</div>';

      let detail='<div class="empty">No current depth-chart player is selected.</div>';
      if(list.length){
        if(!selectedSpecialist||!list.some(function(x){return String(x.num)===String(selectedSpecialist);})){selectedSpecialist=String(list[0].num||'');}
        const currentItem=list.find(function(x){return String(x.num)===String(selectedSpecialist);})||list[0];
        if(currentItem&&currentItem._officialPunter){
          detail=officialPunterProfile(currentItem);
        }else{
          try{detail=selectedProfile(a,playerCategory,list);}catch(_){
            const current=list.map(function(x){return enrichSelaPlayer(x.p);});
            detail=prepSelectedProfile(current);
          }
        }
      }

      return reportBanner('Player Intelligence')+
        title('Player Intelligence',opponent+' published 2026 special-teams depth with available PFF performance attached to the same current player.')+
        '<div class="card"><div class="context">Active team: <b>'+h((typeof selectedTeam==='function'&&selectedTeam())||'')+'</b>. '+h(opponent)+' roster loaded: <b>'+rosterCount+'</b> players. Command Center Week 3 depth controls these player cards.</div></div>'+
        categoryTabs()+
        '<div class="card"><div class="eyebrow">'+h(label)+'</div><div class="playerCardGrid" style="margin-top:10px">'+cards+'</div></div>'+
        '<div style="margin-top:14px">'+detail+'</div>';
    }catch(error){
      console.error('Current opponent Player Intelligence patch failed:',error);
      return originalPlayerPage(a);
    }
  };

  // Install immediately when SELA is already active. If the user changes opponents
  // later, the wrapped loader/page functions above take over on the next render.
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
