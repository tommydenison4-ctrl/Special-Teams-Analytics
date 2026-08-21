SPECIAL TEAMS INTELLIGENCE V8.7

FIXES
1. Vercel build failure:
   - vercel.json no longer declares api/sync-roster.js in a Functions pattern.
   - Vercel auto-detects the API files in /api.
   - This avoids the "pattern doesn't match any Serverless Functions" build failure.

2. Mobile:
   - Header controls wrap into a 2-column mobile grid.
   - Navigation becomes a horizontal swipeable row.
   - Filters become responsive.
   - Cards and metrics stack correctly.
   - Tables scroll horizontally instead of forcing the whole page wide.
   - Chart/spray/look fields stay within the phone width.
   - Practice-card and Look Library controls stack cleanly.

IMPORTANT
Upload the FULL V8.7 repository, not only index.html.
The /api folder must stay present.
