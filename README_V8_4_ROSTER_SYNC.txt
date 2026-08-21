SPECIAL TEAMS INTELLIGENCE V8.4 - INTEGRATED ROSTER SYNC

This build removes the need for the separate NCAA roster-builder app.

FINAL WORKFLOW
PFF:
- Supabase Storage / Special Teams / Current / offense-side.csv
- Supabase Storage / Special Teams / Current / defense-side.csv

ROSTER:
- In Special Teams Intelligence open Roster / Team Settings.
- Paste the official football roster URL.
- Click Sync Roster to Supabase.
- The server builds the roster and automatically writes:
  Special Teams / Current / roster.json
- The app immediately reloads that file.
- Staff users get the same roster automatically.

FILES ADDED / CHANGED
- index.html
- package.json
- vercel.json
- api/sync-roster.js

KEEP ALL OTHER REPOSITORY FILES.

VERCEL ENVIRONMENT VARIABLES REQUIRED
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

IMPORTANT
The Special Teams bucket must remain Public because the staff app reads the CSV and roster JSON from its public Storage URLs.
