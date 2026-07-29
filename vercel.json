create table if not exists public.special_teams_projects (
  id text primary key,
  edit_key_hash text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.special_teams_projects enable row level security;

-- No public policies are required. The Vercel server function uses the
-- Supabase service-role key and the browser never receives that key.
