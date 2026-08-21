{
  "name": "special-teams-intelligence",
  "version": "7.3.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "20.x"
  }
}


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
