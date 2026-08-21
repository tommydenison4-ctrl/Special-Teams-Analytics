V9.1 FIX

The screenshot exposed two separate bugs:
1. bindPlayerPages is not defined. That crashed the browser binding cycle.
2. roster.json was being read through the public Storage URL and Supabase returned 400.

V9.1:
- removes the invalid bindPlayerPages() call
- adds /api/roster
- reads roster.json through Vercel using the existing SUPABASE_SERVICE_ROLE_KEY
- changes player enrichment to read roster.json through the authenticated Storage endpoint too
- does not require any new environment variables

DEPLOY:
Upload the entire V9.1 repository, not only index.html, because api/roster.js is new.
Then redeploy in Vercel and open ?admin=1.
Click Reload Latest first. It should say the Supabase roster loaded with 99 players.
Then click Refresh Player Photos / Bios.
