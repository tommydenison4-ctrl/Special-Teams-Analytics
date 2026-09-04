from pathlib import Path

# Patch the fixed UAB enrichment endpoint so the Week 2 page can trigger
# a constrained refresh without exposing the admin key. The endpoint can
# only touch the fixed UAB roster path.
p = Path('api/enrich-roster-uab.js')
s = p.read_text()

if "PHOTO_REFRESH_VERSION" not in s:
    s = s.replace(
        "const OBJECT_PATH = 'Opponents/UAB/roster.json';",
        "const OBJECT_PATH = 'Opponents/UAB/roster.json';\nconst PHOTO_REFRESH_VERSION = 'uab-photos-2026-09-04-v2';"
    )

old_auth = "    if (String(body.adminKey || '') !== adminKey) {\n      return sendJson(res, 403, { error: 'Incorrect admin key.' });\n    }\n\n    const batchSize"
new_auth = "    const publicUabRefresh = body.publicUabRefresh === true;\n    if (!publicUabRefresh && String(body.adminKey || '') !== adminKey) {\n      return sendJson(res, 403, { error: 'Incorrect admin key.' });\n    }\n\n    const batchSize"
s = s.replace(old_auth, new_auth)

s = s.replace(
    "      imageVerifiedAt: new Date().toISOString()\n    };",
    "      imageVerifiedAt: new Date().toISOString(),\n      photoRefreshVersion: PHOTO_REFRESH_VERSION\n    };"
)
s = s.replace(
    "    return { ...player, imageVerifiedAt: new Date().toISOString() };",
    "    return { ...player, imageVerifiedAt: new Date().toISOString(), photoRefreshVersion: PHOTO_REFRESH_VERSION };"
)

old_pending = (
    "    // Skip players already enriched. Also skip profile-less players so one bad record\n"
    "    // cannot cause an endless client loop.\n"
    "    const pendingIndexes = [];\n"
    "    for (let i = 0; i < players.length; i++) {\n"
    "      const p = players[i];\n"
    "      if (p.profile && (!p.imageVerifiedAt || !p.image || !p.bio)) pendingIndexes.push(i);\n"
    "      if (pendingIndexes.length >= batchSize) break;\n"
    "    }\n"
)
new_pending = (
    "    // Public button refreshes every official UAB profile once per refresh version.\n"
    "    // Admin enrichment keeps the existing photo/bio completion behavior.\n"
    "    const pendingIndexes = [];\n"
    "    for (let i = 0; i < players.length; i++) {\n"
    "      const p = players[i];\n"
    "      const needsPublicPhotoRefresh = publicUabRefresh && p.profile && p.photoRefreshVersion !== PHOTO_REFRESH_VERSION;\n"
    "      const needsAdminEnrichment = !publicUabRefresh && p.profile && (!p.imageVerifiedAt || !p.image || !p.bio);\n"
    "      if (needsPublicPhotoRefresh || needsAdminEnrichment) pendingIndexes.push(i);\n"
    "      if (pendingIndexes.length >= batchSize) break;\n"
    "    }\n"
)
s = s.replace(old_pending, new_pending)

s = s.replace(
    "        completed: players.filter(p => !p.profile || p.imageVerifiedAt).length,",
    "        completed: publicUabRefresh ? players.filter(p => !p.profile || p.photoRefreshVersion === PHOTO_REFRESH_VERSION).length : players.filter(p => !p.profile || p.imageVerifiedAt).length,"
)
s = s.replace(
    "    const completed = players.filter(p => !p.profile || p.imageVerifiedAt).length;\n"
    "    const remaining = players.filter(p => p.profile && (!p.imageVerifiedAt || !p.image || !p.bio)).length;",
    "    const completed = publicUabRefresh ? players.filter(p => !p.profile || p.photoRefreshVersion === PHOTO_REFRESH_VERSION).length : players.filter(p => !p.profile || p.imageVerifiedAt).length;\n"
    "    const remaining = publicUabRefresh ? players.filter(p => p.profile && p.photoRefreshVersion !== PHOTO_REFRESH_VERSION).length : players.filter(p => p.profile && (!p.imageVerifiedAt || !p.image || !p.bio)).length;"
)

p.write_text(s)

# Patch the Week 2 wrapper. The generated app gets a real header button
# immediately before Roster / Team Settings plus the click handler.
p = Path('uab/index.html')
s = p.read_text()
marker = "      document.open();"

if 'refreshUabPhotosBtn' not in s:
    inject = """      // Visible Week 2 control: refresh official UAB player photos.\n      html = html.replace(\n        /(<button[^>]*id=[\"']teamSettingsBtn[\"'][^>]*>)/i,\n        '<button id=\"refreshUabPhotosBtn\" type=\"button\" title=\"Refresh UAB player photos from official profiles\">Refresh UAB Player Photos</button>$1'\n      );\n\n      const uabPhotoRefreshScript = `<script>\n      (function(){\n        const btn=document.getElementById('refreshUabPhotosBtn');\n        if(!btn)return;\n        btn.addEventListener('click',async function(){\n          if(btn.dataset.busy==='1')return;\n          btn.dataset.busy='1';\n          const original='Refresh UAB Player Photos';\n          btn.disabled=true;\n          btn.textContent='Refreshing UAB Photos…';\n          try{\n            let result=null;\n            for(let pass=0;pass<20;pass++){\n              const r=await fetch('/api/enrich-roster-uab',{\n                method:'POST',\n                headers:{'content-type':'application/json'},\n                body:JSON.stringify({publicUabRefresh:true,batchSize:8})\n              });\n              let j={};\n              try{j=await r.json();}catch(e){}\n              if(!r.ok)throw new Error(j.error||('Photo refresh returned '+r.status));\n              result=j;\n              btn.textContent='UAB Photos '+(j.completed||0)+'/'+(j.total||0);\n              if(j.done)break;\n            }\n            if(typeof loadRosterFromSupabase==='function')await loadRosterFromSupabase();\n            if(typeof render==='function')render();\n            const photos=result&&result.photos!=null?result.photos:'?';\n            btn.textContent='Photos Refreshed • '+photos;\n            setTimeout(function(){btn.textContent=original;btn.disabled=false;btn.dataset.busy='0';},2500);\n          }catch(err){\n            console.error(err);\n            btn.textContent='Photo Refresh Failed';\n            btn.disabled=false;\n            btn.dataset.busy='0';\n            alert('UAB photo refresh failed: '+(err&&err.message?err.message:err));\n          }\n        });\n      })();\n      <\\/script>`;\n      html = html.replace('</body>', uabPhotoRefreshScript + '</body>');\n\n"""
    if marker not in s:
        raise SystemExit('document.open marker not found in uab/index.html')
    s = s.replace(marker, inject + marker, 1)

p.write_text(s)

assert 'refreshUabPhotosBtn' in Path('uab/index.html').read_text()
assert 'publicUabRefresh' in Path('api/enrich-roster-uab.js').read_text()
assert 'PHOTO_REFRESH_VERSION' in Path('api/enrich-roster-uab.js').read_text()
print('UAB photo refresh button patch prepared.')
