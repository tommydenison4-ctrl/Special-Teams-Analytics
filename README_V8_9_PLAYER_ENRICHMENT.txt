SPECIAL TEAMS INTELLIGENCE V8.9 — PLAYER PHOTOS + BIOS

WHAT CHANGED
- Sync Roster first creates the full roster.json quickly.
- The app then automatically enriches roster players in batches of 8.
- Each batch visits player profile pages and looks for:
  1. Headshot / og:image
  2. Main roster biography section
- roster.json is overwritten after each batch.
- Existing image/bio values are preserved and skipped on future syncs.
- Team Settings includes "Refresh Player Photos / Bios" for manual refresh.

NORMAL WORKFLOW
1. Open admin URL: ?admin=1
2. Roster / Team Settings
3. Paste official football roster URL
4. Click Sync Roster to Supabase
5. Enter SPECIAL_TEAMS_ADMIN_KEY if asked
6. Base roster saves immediately
7. Photos/bios fill in batch-by-batch
8. Coaches only refresh the normal link

SUPABASE
Special Teams / Current / roster.json
is still the only player file coaches read.

No new Vercel environment variables are required.
