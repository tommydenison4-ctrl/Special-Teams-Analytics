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
