# Special Teams Intelligence V7.2

This build is structured for GitHub + Vercel + Supabase.

## Required repository structure

Keep these files at the repository root:

```
api/
  import-roster.js
  project.js
index.html
package.json
supabase_setup.sql
```

There is intentionally no `vercel.json` file.

## Vercel environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

After adding or changing variables, redeploy.

## Health tests

After deployment, open:

- `/api/import-roster`
- `/api/project`

Both should return JSON with `ok: true`.

## Supabase

Run `supabase_setup.sql` once in the SQL Editor. If the table already exists, the script will not overwrite it.
