SPECIAL TEAMS INTELLIGENCE V8.1 — SHARED CURRENT BUILD

WHAT CHANGED
- One permanent staff link loads the latest published project.
- Your browser becomes the editor after the first Publish Current and keeps the edit key locally.
- Everyone else is read-only.
- PFF imports, roster changes, team settings and chart-look changes auto-publish.
- Reload Latest refreshes data already published by the editor.
- Chart Looks now switch correctly among Punt Team, Punt Return, Kickoff Coverage and Kickoff Return even if the toolbar unit filter was on another unit.
- Punt and kickoff spray flight lines are clickable.
- Added kickoff landing-zone report: end zone returned/no return, goal line–5, 6–10, 11–15, outside 15.
- Added punt landing-zone report: end zone/touchback, goal line–5, 6–10, 11–15, 16–20.
- Landing-zone tables include hang-time and result metrics.

GITHUB STRUCTURE
index.html
package.json
api/
  project.js

KEEP your existing roster/import API files in api/. Do not delete them.

IMPORTANT
This uses your existing Supabase special_teams_projects table and the existing Vercel environment variables:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

FIRST USE
1. Upload/replace index.html and api/project.js.
2. Keep all other existing API files.
3. Deploy.
4. On YOUR browser, load PFF + roster and click Publish Current once.
5. Copy Staff Link.
6. Other users opening that link are read-only and always load the latest published data.

IMPORTANT UPDATE
- This build contains NO embedded ULM/PFF sample data and NO hardcoded roster. A fresh deployment starts blank unless a published 'current' project exists in Supabase.


SPECIAL TEAMS INTELLIGENCE V8.2 — SUPABASE STORAGE DATA SOURCE

PFF DATA SOURCE
The app no longer loads PFF CSV files from the browser.
It automatically reads BOTH public files from:

Bucket: Special Teams
Folder: Current
- offense-side.csv
- defense-side.csv

Supabase project:
https://hzrosmevuejjlxigdxmg.supabase.co

The two CSVs are fetched every time the app opens or Reload Latest is pressed.
They are merged in memory and duplicate plays are merged by GAMEID + PLAYID
(with GSIS/fallback keys when needed).

TO UPDATE PFF DATA
1. Open Supabase Storage.
2. Open Special Teams / Current.
3. Replace offense-side.csv.
4. Replace defense-side.csv.
5. Do not change the filenames.
6. Open/refresh the app or press Reload Latest.

WHAT STILL USES THE CURRENT PROJECT API
- rosterData
- team settings
- saved movable Chart Looks
- rep assignments

PFF rows are intentionally NOT written into project.json/database anymore.

V8.3 ROSTER STORAGE
The app now also reads:
Special Teams / Current / roster.json

Accepted roster.json formats:
1. A plain array of player objects
2. {"players":[...player objects...]}

The app loads project settings/looks, then roster.json, then the two PFF CSVs.
