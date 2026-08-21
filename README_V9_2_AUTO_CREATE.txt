SPECIAL TEAMS INTELLIGENCE V9.2

WHAT THE LAST SCREENSHOT PROVED
- The browser still has 99 roster records.
- Supabase Storage does NOT currently have Current/roster.json.
- Therefore the enrichment endpoint had nothing to open and correctly returned Object not found.

V9.2 FIX
- Refresh Player Photos / Bios now sends the browser's existing 99-player roster to the server as a fallback.
- If roster.json does not exist, the server automatically creates it in:
  Special Teams / Current / roster.json
- It then starts enriching that same file with photos and bios.
- No manual JSON upload is required.

DEPLOY THE WHOLE REPOSITORY.
Then:
1. Open ?admin=1
2. Go to Roster / Team Settings
3. Click Refresh Player Photos / Bios
4. The existing 99-player roster will seed roster.json automatically
5. Enrichment begins in batches
