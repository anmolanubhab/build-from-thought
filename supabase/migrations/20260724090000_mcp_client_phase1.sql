-- MCP (Model Context Protocol) client, Phase 1.
--
-- Lets a workspace connect to real, network-reachable MCP servers (GitHub's
-- and Stripe's and Firecrawl's official hosted servers, plus any custom MCP
-- server URL) and have the AI planner in mcp-chat use their tools. All
-- protocol traffic happens server-side in edge functions using the
-- service role key; these tables/policies only need to protect cached
-- metadata and a reference to an encrypted secret, never the secret itself.

-- 1. mcp_servers: catalog of connectable server *kinds* (presets). Public
--    read — it's just metadata, no per-workspace data lives here.
create table public.mcp_servers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  endpoint_url text,
  auth_kind text not null check (auth_kind in ('bearer', 'url_key', 'reuse_github_token')),
  doc_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.mcp_servers enable row level security;

create policy "Anyone signed in can view server presets"
  on public.mcp_servers for select
  using (auth.uid() is not null);

insert into public.mcp_servers (slug, name, description, endpoint_url, auth_kind, doc_url) values
  ('github', 'GitHub', 'Repos, issues, pull requests — uses your existing connected GitHub account.', 'https://api.githubcopilot.com/mcp/', 'reuse_github_token', 'https://github.com/github/github-mcp-server'),
  ('stripe', 'Stripe', 'Customers, payments, and subscriptions via a restricted API key.', 'https://mcp.stripe.com', 'bearer', 'https://docs.stripe.com/mcp'),
  ('firecrawl', 'Firecrawl', 'Web scraping, crawling, and search via your Firecrawl API key.', 'https://mcp.firecrawl.dev/{API_KEY}/v2/mcp', 'url_key', 'https://docs.firecrawl.dev/mcp');

-- 2. mcp_connections: a workspace's actual configured connection. Never
--    stores a plaintext secret — only a reference into Supabase Vault
--    (or a flag to reuse the workspace member's existing GitHub token).
create table public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  server_id uuid references public.mcp_servers(id) on delete set null,
  name text not null,
  endpoint_url text not null,
  vault_secret_id uuid,
  reuse_github_token boolean not null default false,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_sync_at timestamptz,
  last_error text,
  capabilities jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mcp_connections enable row level security;

create index idx_mcp_connections_workspace_id on public.mcp_connections(workspace_id);

create policy "Workspace members can view connections"
  on public.mcp_connections for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace owner can manage connections"
  on public.mcp_connections for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- 3. mcp_tools: cached tools/list result per connection. Client-readable,
--    but only ever written by edge functions running as service_role — no
--    insert/update/delete policy exists for anon/authenticated.
create table public.mcp_tools (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mcp_connections(id) on delete cascade,
  name text not null,
  description text,
  input_schema jsonb not null default '{}'::jsonb,
  is_stale boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (connection_id, name)
);

alter table public.mcp_tools enable row level security;

create index idx_mcp_tools_connection_id on public.mcp_tools(connection_id);

create policy "Workspace members can view tools"
  on public.mcp_tools for select
  using (exists (
    select 1 from public.mcp_connections c
    where c.id = mcp_tools.connection_id and public.is_workspace_member(c.workspace_id)
  ));

-- 4. mcp_logs: execution log — doubles as the audit log. Client-readable,
--    service-role-only writes (same split as mcp_tools).
create table public.mcp_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.mcp_connections(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoked_by uuid references auth.users(id) on delete set null,
  tool_name text not null,
  request_args jsonb,
  status text not null check (status in ('ok', 'error')),
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.mcp_logs enable row level security;

create index idx_mcp_logs_workspace_id_created_at on public.mcp_logs(workspace_id, created_at desc);
create index idx_mcp_logs_connection_id on public.mcp_logs(connection_id);

create policy "Workspace members can view logs"
  on public.mcp_logs for select
  using (public.is_workspace_member(workspace_id));

-- 5. mcp_permissions: which workspace roles may *execute* a connection's
--    tools. Connect/disconnect/reconnect stay owner-only via the table
--    policies above — this only gates tool execution for non-owners.
create table public.mcp_permissions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mcp_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  can_execute boolean not null default true,
  unique (connection_id, role)
);

alter table public.mcp_permissions enable row level security;

create policy "Workspace members can view permissions"
  on public.mcp_permissions for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace owner can manage permissions"
  on public.mcp_permissions for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- 6. Vault access wrapper functions. supabase_vault is already installed on
--    this project. These are the only way to create/read/delete an MCP
--    connection's secret; EXECUTE is revoked from anon/authenticated so
--    only service-role callers (our edge functions) can ever use them —
--    the raw secret is never reachable through the client-facing API.
create or replace function public.mcp_vault_create_secret(p_secret text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select vault.create_secret(p_secret, coalesce(p_name, 'mcp_connection_' || gen_random_uuid()::text)) into v_id;
  return v_id;
end;
$$;

revoke execute on function public.mcp_vault_create_secret(text, text) from public, anon, authenticated;
grant execute on function public.mcp_vault_create_secret(text, text) to service_role;

create or replace function public.mcp_vault_read_secret(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = p_id;
  return v_secret;
end;
$$;

revoke execute on function public.mcp_vault_read_secret(uuid) from public, anon, authenticated;
grant execute on function public.mcp_vault_read_secret(uuid) to service_role;

create or replace function public.mcp_vault_delete_secret(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where id = p_id;
end;
$$;

revoke execute on function public.mcp_vault_delete_secret(uuid) from public, anon, authenticated;
grant execute on function public.mcp_vault_delete_secret(uuid) to service_role;
