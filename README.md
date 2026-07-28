# Special Teams Intelligence V6.6

This is the GitHub and Vercel build. It includes a real server-side roster importer at `api/import-roster.js`.

## Deploy

1. Create a new GitHub repository.
2. Upload every file and folder from this package. Keep the `api` folder at the repository root.
3. In Vercel, choose **Add New Project** and import the GitHub repository.
4. Leave Framework Preset as **Other** and deploy. No build command is required.
5. Open the Vercel deployment URL, not the local `index.html` file.
6. Open **Roster / Team Settings** in the platform.
7. Enter the university, nickname, exact PFF team code, and official roster URL.
8. Click **Connect Roster URL**.

## Required repository structure

```text
index.html
api/
  import-roster.js
package.json
vercel.json
sample_pff_special_teams.csv
roster_template.csv
```

## What the roster URL imports

The importer reads common Sidearm Sports roster pages and returns player name, number, position, height, weight, class, hometown, high school, previous school, image URL, and official profile URL when those fields are present.

The roster supplies player identity and biography links. The PFF CSV supplies performance statistics. The exact PFF team code must match the code in the PFF export.

## Test the API

After deployment, open `/api/import-roster` on the Vercel domain. You should see a small JSON response showing that the service is running. The actual roster import uses POST requests from the platform.

## Local use

Double-clicking `index.html` will still display the platform, but URL roster importing requires the Vercel deployment. CSV and JSON roster uploads remain available locally.
