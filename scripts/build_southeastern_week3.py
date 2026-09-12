from pathlib import Path
import re

root = Path('.')
out = root / 'southeastern'
out.mkdir(exist_ok=True)

# Preserve the exact working UAB engine as the Week 3 template.
(out / 'week3-template.html').write_bytes((root / 'uab/week2-template.html').read_bytes())

s = (root / 'uab/index.html').read_text()

# Core workspace identity. These are wrapper-only substitutions.
reps = [
    ('ULM Special Teams • Week 2 • UAB', 'ULM Special Teams • Week 3 • Southeastern Louisiana'),
    ('Loading Week 2 • UAB…', 'Loading Week 3 • Southeastern Louisiana…'),
    ('ULM_ST_2026_W2_UAB::', 'ULM_ST_2026_W3_SELA::'),
    ('UAB_PACKAGE_BASE', 'SELA_PACKAGE_BASE'),
    ('Special%20Teams/Opponents/UAB', 'Special%20Teams/Opponents/SoutheasternLA'),
    ("week: 2,", "week: 3,"),
    ("opponent: 'UAB',", "opponent: 'Southeastern Louisiana',"),
    ("rawTeamCode: 'ALBI',", "rawTeamCode: 'LASE',"),
    ("sourcePackage: 'Special Teams/Opponents/UAB',", "sourcePackage: 'Special Teams/Opponents/SoutheasternLA',"),
    ('function uabDepthPage', 'function selaDepthPage'),
    ('UAB_WEEK2_DEPTH', 'SELA_WEEK3_DEPTH'),
    ("fetch('/uab/week2-template.html'", "fetch('/southeastern/week3-template.html'"),
    ("'storage-project-uab'", "'storage-project-sela'"),
    ("'sync-roster-uab'", "'sync-roster-sela'"),
    ("'enrich-roster-uab'", "'enrich-roster-sela'"),
    ("'roster-uab'", "'roster-sela'"),
    ('UAB_PLAYER_INTEL_DEPTH_PATCH', 'SELA_PLAYER_INTEL_DEPTH_PATCH'),
    ('uabPlayerIntelPatch', 'selaPlayerIntelPatch'),
    ('uabDepthItems', 'selaDepthItems'),
    ('uabDepthRolesForCategory', 'selaDepthRolesForCategory'),
    ('uabMergeDepth', 'selaMergeDepth'),
    ('uabDepthCard', 'selaDepthCard'),
    ('uabSelectedProfile', 'selaSelectedProfile'),
    ("'const UAB_WEEK2_DEPTH='", "'const SELA_WEEK3_DEPTH='"),
    ("replace(/^function uabDepthPage/", "replace(/^function selaDepthPage/"),
    ('Week 2 ST Depth Chart', 'Week 3 ST Depth Chart'),
    ('Week 2 UAB could not load:', 'Week 3 Southeastern Louisiana could not load:'),
]
for a, b in reps:
    s = s.replace(a, b)

# Published 2026 Southeastern Louisiana Week 3 special-teams depth chart.
pattern = r"const fallbackDepth = \{[\s\S]*?\n    \};\n\n    function selaDepthPage"
block = """const fallbackDepth = {
      team:'Southeastern Louisiana', nickname:'Lions', season:2026, updated:'2026-09-12', source:'2026 Southeastern Louisiana Football Game Notes',
      specialTeams:{
        PT:[['46','Jack Hunter','Sr.'],['28','Aiden Parker','So.']],
        PK:[['29','Drew Talley','So.'],['27','Owen Wiley','Jr.']],
        KO:[['27','Owen Wiley','Jr.'],['29','Drew Talley','So.']],
        LS:[['41','Shawn Puissegur','So.'],['13','Conner Nelson','So.']],
        H:[['46','Jack Hunter','Sr.']],
        PR:[['9','Dkhai Joseph','Jr.'],['82','Desmen Jefferson','Fr.'],['19','Blake Smith','Fr.']],
        KR:[['2','Kyree Paul','So.'],['4','Tristan Goodly','Sr.']]
      }
    };

    function selaDepthPage"""
s, n = re.subn(pattern, block, s, count=1)
if n != 1:
    raise SystemExit(f'fallback depth replacement failed: {n}')

s = s.replace("const source=SELA_WEEK3_DEPTH.source||'Ourlads';", "const source=SELA_WEEK3_DEPTH.source||'2026 Southeastern Louisiana Football Game Notes';")
s = s.replace("const updated=SELA_WEEK3_DEPTH.updated?String(SELA_WEEK3_DEPTH.updated).slice(0,10):'2026-09-03';", "const updated=SELA_WEEK3_DEPTH.updated?String(SELA_WEEK3_DEPTH.updated).slice(0,10):'2026-09-12';")
s = s.replace('WEEK 2 • UAB', 'WEEK 3 • SOUTHEASTERN LOUISIANA')
s = s.replace('September 12, 2026 • 2:30 PM CT • Protective Stadium • ESPN+', 'September 19, 2026 • 3:30 PM CT • Malone Stadium • ESPN+')
s = s.replace('Click any player name to open his UAB roster profile.', 'Click any player name to open his Southeastern Louisiana roster profile.')

# Dedicated Week 3 team identity and official roster source.
s = s.replace(
    "const DEFAULT_TEAM_SETTINGS={teamName:'UAB',nickname:'Blazers',teamCode:'ALBI',rosterUrl:'https://uabsports.com/sports/football/roster',season:'2025'};",
    "const DEFAULT_TEAM_SETTINGS={teamName:'Southeastern Louisiana',nickname:'Lions',teamCode:'LASE',rosterUrl:'https://lionsports.net/sports/football/roster',season:'2025'};"
)
s = s.replace(
    "if(d.teamSettings)teamSettings={...DEFAULT_TEAM_SETTINGS,...d.teamSettings,teamName:'UAB',nickname:'Blazers',teamCode:'ALBI',rosterUrl:'https://uabsports.com/sports/football/roster'};",
    "if(d.teamSettings)teamSettings={...DEFAULT_TEAM_SETTINGS,...d.teamSettings,teamName:'Southeastern Louisiana',nickname:'Lions',teamCode:'LASE',rosterUrl:'https://lionsports.net/sports/football/roster'};"
)
s = s.replace("ULM:'ULM',LAMON:'ULM',ALBI:'UAB',UAB:'UAB',", "ULM:'ULM',LAMON:'ULM',LASE:'Southeastern Louisiana',")

# Human-facing Player Intelligence copy only.
s = s.replace('UAB roster loaded:', 'Southeastern Louisiana roster loaded:')
s = s.replace('UAB depth-chart players remain visible', 'Southeastern Louisiana depth-chart players remain visible')
s = s.replace('UAB Special Teams Depth Chart', 'Southeastern Louisiana Special Teams Depth Chart')
s = s.replace("p.name||'UAB player'", "p.name||'Southeastern Louisiana player'")
s = s.replace("p.name||'UAB Player'", "p.name||'Southeastern Louisiana Player'")
s = s.replace('UAB SPECIAL TEAMS DEPTH CHART', 'SOUTHEASTERN LOUISIANA SPECIAL TEAMS DEPTH CHART')
s = s.replace('Current UAB roster', 'Current Southeastern Louisiana roster')
s = s.replace('Week 2 UAB player intelligence.', 'Week 3 Southeastern Louisiana player intelligence.')
s = s.replace('current UAB special-teams depth chart', 'current Southeastern Louisiana special-teams depth chart')
s = s.replace('Active team: <b>UAB</b>.', 'Active team: <b>Southeastern Louisiana</b>.')
s = s.replace("||'UAB Players'", "||'Southeastern Louisiana Players'")

# Ryder Burton exclusion is UAB-specific; Week 3 should not inherit it.
ryder = ".filter(function(x){var p=(x&&x.p)||rosterByNumber(x&&x.num);return nameKey(p&&p.name)!=='ryder burton';})"
s = s.replace(ryder, '')

# Week 3 depth bio copy.
s = s.replace(".replace(/MISSISSIPPI STATE/g,'UAB').replace(/Week 1/g,'Week 2')", ".replace(/MISSISSIPPI STATE/g,'SOUTHEASTERN LOUISIANA').replace(/Week 1/g,'Week 3')")

# Week 3 returns to Week 2 UAB.
s = s.replace(
    "const weekButton = '<a class=\"weekJumpBtn\" href=\"/\">← WEEK 1 • MISSISSIPPI STATE</a>';",
    "const weekButton = '<a class=\"weekJumpBtn\" href=\"/uab/\">← WEEK 2 • UAB</a>';"
)

(out / 'index.html').write_text(s)
(out / 'README.md').write_text("""# Week 3 — Southeastern Louisiana

Dedicated Week 3 ULM Special Teams workspace.

- URL: `/southeastern/`
- Browser namespace: `ULM_ST_2026_W3_SELA::`
- Shared cloud row: `2026_week3_sela_v1`
- Supabase source package: `Special Teams/Opponents/SoutheasternLA/`
- PFF team code: `LASE`
- Expected PFF files: `offensive-side.csv`, `defensive-side.csv`
- Roster: `roster.json`
- Depth chart: published 2026 Week 3 Southeastern Louisiana special-teams depth is embedded as a fallback.
""")

# Isolated Week 3 API endpoints.
storage = (root / 'api/storage-project-uab.js').read_text()
storage = storage.replace('2026_week2_uab_v2', '2026_week3_sela_v1')
(root / 'api/storage-project-sela.js').write_text(storage)

roster = (root / 'api/roster-uab.js').read_text()
roster = roster.replace('Opponents/UAB/roster.json', 'Opponents/SoutheasternLA/roster.json')
roster = roster.replace('UAB roster', 'Southeastern Louisiana roster').replace('No UAB ', 'No Southeastern Louisiana ')
(root / 'api/roster-sela.js').write_text(roster)

sync = (root / 'api/sync-roster-uab.js').read_text().replace('Opponents/UAB/roster.json', 'Opponents/SoutheasternLA/roster.json')
(root / 'api/sync-roster-sela.js').write_text(sync)

enrich = (root / 'api/enrich-roster-uab.js').read_text().replace('Opponents/UAB/roster.json', 'Opponents/SoutheasternLA/roster.json')
(root / 'api/enrich-roster-sela.js').write_text(enrich)

now = (root / 'api/sync-uab-now.js').read_text()
now = now.replace("./sync-roster-uab.js", "./sync-roster-sela.js")
now = now.replace('Week 2 UAB', 'Week 3 Southeastern Louisiana')
now = now.replace('https://uabsports.com/sports/football/roster', 'https://lionsports.net/sports/football/roster')
now = now.replace("teamName: 'UAB'", "teamName: 'Southeastern Louisiana'")
now = now.replace("nickname: 'Blazers'", "nickname: 'Lions'")
now = now.replace("teamCode: 'ALBI'", "teamCode: 'LASE'")
(root / 'api/sync-sela-now.js').write_text(now)

# Add only a forward navigation button to the existing UAB wrapper.
upath = root / 'uab/index.html'
u = upath.read_text()
old = "const weekButton = '<a class=\"weekJumpBtn\" href=\"/\">← WEEK 1 • MISSISSIPPI STATE</a>';"
new = "const weekButton = '<a class=\"weekJumpBtn\" href=\"/\">← WEEK 1 • MISSISSIPPI STATE</a><a class=\"weekJumpBtn\" href=\"/southeastern/\">WEEK 3 • SOUTHEASTERN LA →</a>';"
if old not in u:
    raise SystemExit('Could not find safe UAB navigation insertion point')
upath.write_text(u.replace(old, new, 1))

# Guardrails: do not allow accidental Week 2 engine edits.
checks = {
    'southeastern/index.html': ['ULM_ST_2026_W3_SELA::', 'Opponents/SoutheasternLA', "teamCode:'LASE'", 'Week 3 ST Depth Chart', '/southeastern/week3-template.html', 'Drew Talley', 'Jack Hunter', 'Kyree Paul'],
    'api/storage-project-sela.js': ['2026_week3_sela_v1'],
    'api/roster-sela.js': ['Opponents/SoutheasternLA/roster.json'],
    'api/sync-roster-sela.js': ['Opponents/SoutheasternLA/roster.json'],
    'api/enrich-roster-sela.js': ['Opponents/SoutheasternLA/roster.json'],
    'api/sync-sela-now.js': ['lionsports.net/sports/football/roster', "teamCode: 'LASE'"]
}
for fn, needles in checks.items():
    text = (root / fn).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Guardrail failed: {fn} missing {needle}')

print('Week 3 Southeastern Louisiana workspace built safely.')
