SPECIAL TEAMS INTELLIGENCE V8.0

This version is completely client-side. It does not use API files, Supabase, Cheerio, package.json, or roster website scraping.

GITHUB:
1. Delete the old api folder.
2. Delete root import-roster.js, project.js, package.json and vercel.json.
3. Upload index.html, roster_template.csv, sample_pff_special_teams.csv and README_FIRST.txt.
4. Commit. Vercel will deploy it as a static site.

USE:
1. Load PFF CSV.
2. Open Roster / Team Settings.
3. Enter University, Nickname and PFF team code, then Save Team.
4. Import Roster CSV / JSON.
5. Click Export Project to download one JSON containing the PFF data, roster, team settings and saved looks.
6. Later click Open Project to restore that complete project.

No server setup is required.
