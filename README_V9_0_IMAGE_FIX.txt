SPECIAL TEAMS INTELLIGENCE V9.0 — PLAYER IMAGE FIX

WHY V8.9 MISSED PHOTOS
Mississippi State's Sidearm roster/profile pages expose player headshots through
Sidearm/CloudFront image elements and srcset values. They are not reliably exposed
through the simple selectors used in V8.9.

V9.0 FIX
- Base roster sync now searches the actual roster card surrounding each player's link.
- It reads img/src, data-src, lazy-src AND source/srcset.
- It scores official Sidearm/CloudFront headshots and ignores logos/banners/placeholders.
- Profile enrichment now scans every official image candidate and strongly prefers:
  * alt text matching the player name
  * URLs containing Headshot / Production / WEB
  * Sidearm/CloudFront image hosts
- Bio extraction was also improved using Career Notes -> Season Career boundaries.

WHAT TO DO
1. Deploy V9.0.
2. Open ?admin=1.
3. Roster / Team Settings.
4. Click Sync Roster to Supabase again.
5. Let player enrichment run.
6. Refresh the normal staff link.

The existing roster.json will be overwritten with image URLs and bios.
