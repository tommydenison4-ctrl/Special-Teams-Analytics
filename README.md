Special Teams Analytics V13.6 — Cross-Device Database Save

This build moves shared Look Library/project persistence from Supabase Storage project.json to a dedicated Supabase database table, matching the reliable cross-device persistence pattern used by the coaching-notes apps.

ONE-TIME SUPABASE SETUP:
1. Supabase -> SQL Editor -> New query.
2. Paste/run SUPABASE_SETUP.sql from this package.
3. Confirm Table Editor shows: special_teams_shared_project
4. Confirm it has one row with id = current.

DEPLOYMENT:
Replace BOTH in the existing GitHub/Vercel repo:
- index.html
- api/storage-project.js
Keep all other existing /api files.

Required Vercel environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

No admin URL or admin password is required.
Anyone with the live app URL can save shared looks/settings.
The app checks for updates every 10 seconds and Reload Latest forces a refresh.
