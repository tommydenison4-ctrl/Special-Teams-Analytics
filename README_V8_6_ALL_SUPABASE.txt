SPECIAL TEAMS INTELLIGENCE V8.6 — ALL DATA IN SUPABASE STORAGE

FINAL SUPABASE STORAGE STRUCTURE

Special Teams
└── Current
    ├── offense-side.csv
    ├── defense-side.csv
    ├── roster.json
    └── project.json

WHAT EACH FILE DOES

offense-side.csv
- Your first PFF Special Teams export.

defense-side.csv
- Your second PFF Special Teams export.
- The app merges both PFF files automatically.

roster.json
- Full roster/player information.
- Created automatically when the admin uses Sync Roster.

project.json
- Team settings.
- Every saved movable special-teams look.
- Every player X/Y coordinate in those looks.
- Rep assignments.
- Updated automatically when the admin saves/changes looks.

COACH / STAFF LINK

https://YOUR-APP.vercel.app/

The coach does NOTHING.
The app automatically loads all four Supabase files.
Staff cannot save, delete, sync or move stored looks.
They can view reports and make practice-card PDFs.

YOUR ADMIN LINK

https://YOUR-APP.vercel.app/?admin=1

The first time you make an edit in a browser session, the app asks for your admin key.
Do not give that key to staff.

VERCEL ENVIRONMENT VARIABLES

Keep:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

ADD:
SPECIAL_TEAMS_ADMIN_KEY

Choose your own private value, for example a long password you will remember.
Do NOT put that value in index.html or GitHub.

PRACTICE CARDS / PDF

Look Library now has:
- Practice Card PDF on every saved look.
- Checkboxes beside saved looks.
- Practice Packet PDF for multiple selected looks.

The PDF tool opens a clean landscape print page.
Click Print / Save PDF in that page.
Each saved look is one page with the exact saved coordinates from Supabase.

UPDATING PFF DATA

1. Supabase > Storage > Special Teams > Current.
2. Replace offense-side.csv.
3. Replace defense-side.csv.
4. Keep those exact filenames.
5. Coaches refresh the same app link.

UPDATING THE ROSTER

1. Open your admin link.
2. Roster / Team Settings.
3. Paste official roster URL.
4. Sync Roster to Supabase.
5. roster.json is overwritten automatically.

UPDATING A DRAWING

1. Open your admin link.
2. Chart Looks.
3. Move players.
4. Save the new look / assignment.
5. project.json is saved to Supabase.
6. Coach reloads the normal link and sees it.
