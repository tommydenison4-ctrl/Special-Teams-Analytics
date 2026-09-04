-- Special Teams Intelligence: shared cross-device project storage
-- Run this ONCE in Supabase -> SQL Editor -> New query -> Run.

create table if not exists public.special_teams_shared_project (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.special_teams_shared_project (id, data, updated_at)
values ('current', '{}'::jsonb, now())
on conflict (id) do nothing;

-- Browser clients do NOT write directly to this table.
-- The Vercel API uses SUPABASE_SERVICE_ROLE_KEY server-side.
alter table public.special_teams_shared_project enable row level security;
