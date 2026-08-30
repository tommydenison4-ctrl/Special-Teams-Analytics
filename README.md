Special Teams Analytics V13.4 — Open Shared Save

Permission model:
- No ?admin=1 URL.
- No admin-key prompt.
- Anyone with the live Vercel app URL can save/edit shared looks, assignments and project settings.
- Local file:// copies remain unable to cloud-save because they do not have the Vercel API routes.
- Shared project data is stored in Supabase Storage: Special Teams / Current / project.json.
- Other devices poll for updates every 10 seconds and can also use Reload Latest.

DEPLOYMENT IMPORTANT:
This package includes a new api/storage-project.js. Deploy BOTH:
1. index.html
2. api/storage-project.js
into the EXISTING GitHub/Vercel repo.
Keep the rest of the existing /api files (roster, sync-roster, enrich-roster, historical-roster, etc.).
Do not wipe the existing repo with only this ZIP.

Required Vercel environment variables remain:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

SPECIAL_TEAMS_ADMIN_KEY is no longer used by storage-project.js in this build.
