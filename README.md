# Special Teams Analytics V13.7 — Print Player Bios

Adds the same Player Profile Pack print workflow used in the ULM offensive/defensive apps:

- Print / Save PDF opens a print center instead of immediately printing.
- Current Special Teams View remains printable.
- Player Profile Pack lets staff hand-select roster players.
- 1, 2, 4, or 8 player profiles per landscape page.
- Player photo, number, position/class/size/hometown/previous school.
- Special-teams production metrics when available.
- Official roster bio excerpt.
- ULM-branded landscape print/PDF layout.

All V13.6 shared-database saving files and Supabase setup are preserved.

## V13.8
- Added Week 1 Mississippi State depth chart to the Special Teams app.
- New sidebar page: Week 1 Depth Chart.
- In-app Offense / Defense / Special Teams tabs.
- Full branded PDF included in the build and linked from the page.
- All V13.7 print-bio functionality remains intact.

## V13.9
- Week 1 depth-chart page is now Special Teams only.
- Removed offense and defense depth-chart tabs from the Special Teams app.
- Special-teams players are clickable.
- Clicking a depth-chart player opens an in-app roster profile with photo, roster metadata and bio.
- Includes a link to the player's full official roster bio when available.

## V14.0 — Chart / Look Library Filter-State Fix
- Fixed Chart Looks unit tabs changing the global Special Teams unit dropdown.
- Chart Looks, Look Library, Play Structure Viewer and Structure Families now use their own Punt/Kickoff tabs independently.
- Dashboard, Hash Intelligence, Spray Reports and Player Intelligence keep their own visible data after visiting Chart Looks / Look Library.
- No refresh should be required to restore kickoff or punt data.

## V14.1 — Unit Filter Reset Fix
- Dashboard now always calculates Kickoff, Punt and Field Goal from the full season/week/team dataset.
- Visiting Chart Looks / Look Library can no longer leave the Dashboard stuck on PUNT or KICKOFF.
- Hash Intelligence, Spray Reports, Player Intelligence, Relationships and structure pages also use their own unit logic rather than the global unit dropdown.
- The global Unit dropdown is automatically cleared/disabled on those pages.
- Unit filtering remains available for Play Log.
- No saved look data or Look Library structure was changed.

## V14.3
- Reduced player marker size on the full-page Special Teams print sheet only.
- Player circles reduced about 29%.
- Jersey number and role text scaled down proportionally.
- Kept the V14.2 header, information boxes, field sizing and print layout unchanged.
- Screen charting and saved Look Library data are untouched.

## V14.4
- Reduced full-page print player markers again (about 18% smaller than V14.3).
- Tightened jersey number and role text proportionally.
- Compressed header and summary spacing without changing the overall design.
- Print sheet is explicitly constrained to one US Letter portrait page at 100% scale.
- Reduced print margins and prevented overflow/page-break spill to a second page.
- Screen charting and saved Look Library data are unchanged.


## V14.5
- Reduced player circles again for print sheets.
- Switched the field SVG to preserve aspect ratio so the diagram no longer stretches/distorts.
- Fixed the print sheet height and removed the nonessential footer so the page fits on one US Letter page more reliably.
- Tightened header and summary spacing slightly without changing the cleaner look.

## V14.6
- Fixed the narrow centered/pillarboxed field introduced when aspect-ratio preservation was enabled.
- Print field now uses a wide 160x110 football coordinate system.
- Player X positions and drawn paths are remapped into that wide field rather than stretched.
- Player circles stay round.
- Field fills the available page width without horizontal distortion.
- Slightly shortened field height for extra one-page print safety.


## V14.7
- Increased print player circle size slightly.
- Increased jersey-number font size for readability.
- Increased role-label font size slightly.
- Kept the wide-field one-page print layout from V14.6.


## V14.8
- Lowered the deepest special-teams player toward the bottom of the print field so more usable field shows above the unit.
- Preserved readable player-number sizing from V14.7.


## V14.9
- Flipped the special-teams visual perspective so the opponent-selected unit sits on top and your team context is at the bottom of the page.
- Renamed unit views from your staff perspective: Punt -> Punt Return, Kickoff -> Kickoff Return, Kickoff Return -> Kickoff, Punt Return -> Punt.
- Existing saved looks are migrated once so old charted looks follow the new orientation.


## V15.0
- Fixed Look Library thumbnails so saved looks keep visible player numbers.
- Each saved player dot now shows jersey number prominently, with the role label beneath it.
- Hover text still shows player label plus role for quick verification.


## V15.1
- Fixed the root cause of player numbers disappearing after saving a look.
- Saved look positions now persist jersey number as a first-class field alongside role, name, X and Y.
- Existing saved looks backfill the number from the stored PFF player label when loaded.
- Look Library thumbnails display saved jersey number first, with role underneath.


## V15.2
- Corrected NCAA/GSIS school-code mapping: MSSO = Southern Miss (Southern Mississippi), not Missouri.
- Missouri mappings remain MIZ / MIZZ / MIZZOU / MIZZO.


## V15.3 — UAB Opponent Prep
- Added Prep Opponent selector: Mississippi State / UAB.
- Mississippi State remains in the existing Current workflow and is not deleted or moved.
- UAB roster loads live from Special Teams / Opponents / UAB / roster.json.
- UAB depth chart loads live from Special Teams / Opponents / UAB / depth-chart.json.
- Opponent Special Teams Depth Chart switches between Mississippi State and UAB.
- Depth-chart players open against the selected opponent roster.
- UAB selection is explicitly prep-only for now; existing PFF analytics continue using Current until UAB PFF CSVs are uploaded.

## V15.5 — UAB Full Analytics Switch
- PREP OPPONENT now switches the complete live package, not only the depth chart.
- Mississippi State uses Special Teams/Current.
- UAB uses Special Teams/Opponents/UAB.
- UAB loads roster.json, depth-chart.json, offense-side.csv and defense-side.csv.
- Player Intelligence switches to the UAB roster and UAB PFF rows.
- Dashboard, Hash Intelligence, Spray Reports, Viewer and other PFF-driven pages switch with the selected opponent.
- Raw PFF team code ALBI is preserved internally but displayed as UAB.
- Mississippi State files remain untouched and are restored by selecting Mississippi State.
- UAB historical 2025 identity is clearly marked unverified where only jersey-number matching is available.

## V15.6 — UAB Historical Identity
- Loads Opponents/UAB/historical-roster-2025.json from Supabase.
- Historical rosters are isolated by opponent and season so UAB and Mississippi State cannot overwrite each other in memory.
- UAB now uses the same strict identity flow as Mississippi State:
  1. historical 2025 jersey resolves to exactly one 2025 player;
  2. that historical name is matched against the current 2026 UAB roster;
  3. same player with a new 2026 jersey is flagged as number changed;
  4. a historical player missing from the 2026 roster is shown as not on current roster.
- Switching opponents and Reload Latest both reload the correct historical roster source.

## V15.7 — UAB CSV Filename Fix
- Fixed UAB PFF load error caused by uploaded filenames.
- UAB now loads offensive-side.csv and defensive-side.csv exactly as they exist in Supabase.
- It falls back to offense-side.csv / defense-side.csv for compatibility.
- Mississippi State Current filenames remain unchanged.


## V15.8 — UAB Current-Week Default
- UAB is now the default prep opponent on first load for the current game week.
- Existing browsers are migrated to UAB once when this version is first opened.
- After that, staff can still manually switch back to Mississippi State and the app will remember their selection.
