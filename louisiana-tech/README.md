# Louisiana Tech · Week 7

October 17, 2026, from the existing Command Center schedule.

Depth chart: Ourlads posting updated 10/10/2026 9:08 AM ET. `depth-chart.json` is a local snapshot, not a PFF dataset or full official roster.

`upload-manifest.json` specifies proposed public Supabase Storage paths and filenames for the next upload. No folders, tables, files or permissions were created in Supabase. Edit storageBase and files to match the actual uploads; file values can be strings or arrays of candidate names. Reload checks this manifest and then each dataset independently. Missing files stay pending; prior opponents are never used as fallbacks. Play feeds must identify LATU in the appropriate offense/defense field and the 2026 season. The existing project uses LATU in its PFF feeds.

Expected uploads:

- offensive: `offensive-side.csv`
- defensive: `defensive-side.csv`
- Roster: `roster.json` (array or {players: [...]})
