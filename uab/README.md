# Week 2 — UAB

This folder is a frozen Week 2 clone of the restored Week 1 Special Teams app.

Isolation rules:
- Week 1 root app remains untouched.
- Week 2 browser storage is prefixed with `ULM_ST_2026_W2_UAB::`.
- UAB Look Library data also uses dedicated keys inside that workspace, so it
  stays isolated even if the template is loaded directly.
- Week 2 shared Supabase state uses clean row `2026_week2_uab_v2`.
- Week 2 roster storage uses `Special Teams/2026/Week2_UAB/roster.json`.
- `week2-template.html` is based on the restored Week 1 snapshot, with explicit
  UAB Look Library and cloud-storage isolation.

The UAB page is `/uab/`.
