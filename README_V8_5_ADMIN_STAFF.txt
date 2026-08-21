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


V8.5 ADMIN / STAFF LINKS

NORMAL LINK
https://YOUR-APP.vercel.app/
- Always read-only
- No roster sync button
- No Team Settings
- No Publish button
- Loads PFF CSVs, roster.json, saved looks and assignments

PRIVATE ADMIN LINK
https://YOUR-APP.vercel.app/?admin=1
- Admin controls appear ONLY when opened in the browser that holds the current project's edit key
- Can sync roster
- Can publish roster/settings/looks
- Has Copy Staff Link and Copy My Admin Link buttons

IMPORTANT
Do not share the ?admin=1 link.
Even if somebody does receive it, the server-side roster sync endpoint also checks the private edit key before it can write roster.json.
