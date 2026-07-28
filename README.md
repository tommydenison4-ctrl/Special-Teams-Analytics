# Special Teams Intelligence V6.7 Persistent Build

This build saves the loaded PFF data, connected roster, team settings, looks and assignments in Supabase. A shared URL containing `?project=...` loads the same saved project for another user.

## 1. Create Supabase storage

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase_setup.sql`.
4. In Supabase Project Settings > API, copy the Project URL and service-role key.

Never place the service-role key in `index.html` or commit a real `.env` file to GitHub.

## 2. Add Vercel environment variables

In Vercel Project Settings > Environment Variables add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Add both to Production, Preview and Development, then redeploy.

## 3. Deploy

Upload the complete folder to GitHub and import the repository into Vercel. Keep the `api` folder at the repository root.

## 4. Use

1. Open the deployed Vercel URL.
2. Load the PFF CSV.
3. Connect or upload the roster.
4. Set the team and exact PFF team code.
5. Click **Save Project**.
6. Click **Copy Share Link**.

The first save creates a project ID and a private edit key stored only in the creator's browser. People opening the share link can view the saved project but cannot overwrite it.

## Important

- Changes are not shared until **Save Project** is clicked again.
- The share URL does not contain the edit key.
- Clearing browser storage removes that browser's ability to overwrite the project, but the shared project remains viewable.
- The included roster URL importer still runs through `/api/import-roster`.
