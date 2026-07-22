-- Devices & Apps page: messaging integrations (Telegram now, WhatsApp UI-ready for later)
-- and desktop-app device registrations (empty until a real desktop app exists).
--
-- RLS note: every table below gets an explicit SELECT policy alongside any
-- UPDATE/DELETE policy for the same role. A prior incident in this project
-- (supabase_connections missing a SELECT policy) proved Postgres's planner
-- folds an UPDATE/DELETE's WHERE clause to "One-Time Filter: false" when no
-- SELECT policy exists for the role — silently matching zero rows even when
-- grants and the dedicated policy are correct. Always pair them.

create table if not exists public.connected_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('telegram', 'whatsapp')),
  status text not null default 'connected' check (status in ('connected', 'not_connected')),
  connected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.connected_apps enable row level security;

-- Inserts/updates for connected_apps happen exclusively through edge functions
-- using the service role (e.g. telegram-webhook confirming a link) — the
-- service role bypasses RLS entirely, so authenticated users only need SELECT
-- (to show status in the UI) and DELETE (to disconnect from the client).
create policy "Users can view their own connected apps"
  on public.connected_apps for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own connected apps"
  on public.connected_apps for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.desktop_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  os text not null,
  app_version text,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.desktop_devices enable row level security;

-- Full CRUD scoped to the owning user — future-ready for a real desktop app
-- to register/update/remove its own device row once it exists.
create policy "Users can view their own desktop devices"
  on public.desktop_devices for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own desktop devices"
  on public.desktop_devices for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own desktop devices"
  on public.desktop_devices for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own desktop devices"
  on public.desktop_devices for delete to authenticated
  using (auth.uid() = user_id);

-- One-time codes used to link a Telegram chat to a WebdevsAI user (Telegram
-- deep link: t.me/<bot>?start=<code>). Service-role only — the edge functions
-- (telegram-connect writes, telegram-webhook reads/consumes) are the only
-- callers, so no authenticated/anon policies are granted at all (default deny).
create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.telegram_link_codes enable row level security;

create index if not exists telegram_link_codes_code_idx on public.telegram_link_codes (code);
