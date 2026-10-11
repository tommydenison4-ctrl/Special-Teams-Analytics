# Louisiana Tech · Week 7

This folder supplies Louisiana Tech data to the existing Week 7 opponent tab. The application shell, analytics pages, navigation, and styling remain shared with every other week.

The 2026 official roster is stored as `roster.json`. Position-only side lists and `depth-chat.json` are supplemental app context; the official roster does not publish starter/backup order. `depth-chart.json` remains the existing Ourlads week 7 snapshot.

The supplied PFF feeds were deduplicated by season, game ID, and play ID, then split into the app's expected `offensive-side.csv` and `defensive-side.csv` uploads for plays with LA Tech (`LATC`) on that side. The cumulative files cover weeks 1, 2, 3, 5, and 6. Import each new week by appending the new LATC special teams plays to these cumulative files, deduplicating on those same IDs, and uploading both CSVs plus `roster.json` to the Supabase Storage path in `upload-manifest.json`. Existing weeks remain in the cumulative exports.

The integration accepts `LATC` and the existing app alias `LATU`; new `LATC` team fields are normalized to the app's existing `LATU` analytics identity so the shared pages behave exactly as they do for other opponents.
