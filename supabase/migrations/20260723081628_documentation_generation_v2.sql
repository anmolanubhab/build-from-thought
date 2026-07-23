-- path: supabase/migrations/20260723081628_documentation_generation_v2.sql
-- Documentation Center v2: cached project analysis + resumable Generate All.
--
-- Two new one-row-per-project tables. Both are intentionally NOT append-only
-- history — they're live status boards the client re-reads on every
-- Documentation Center mount, so a single upserted row per project keeps
-- "resume" and "cache hit" trivial (one primary-key lookup, no ordering/
-- latest-row logic needed).
--
-- project_analysis_cache
--   Holds the DERIVED facts (framework, file tree, routes, api routes, env
--   vars, auth files, components, package.json summary, README excerpt,
--   database, deployments, domains, github-connected) that
--   generate-documentation used to recompute from `projects.files` on every
--   single section request. The client already computes a project fingerprint
--   (src/lib/documentation/hash.ts) for Auto Sync; generate-documentation now
--   receives that same fingerprint and reuses this cache row whenever it
--   matches, skipping the `projects` (incl. potentially large `files` jsonb)
--   read entirely. A mismatched fingerprint means the project changed, so the
--   row is recomputed and upserted — this is the entire invalidation story,
--   no separate invalidation trigger needed.
--
-- documentation_generation_jobs
--   Tracks a "Generate All" run: which sections it targets, and the
--   pending/running/completed/failed status of each one, so the UI can
--   render live progress, survive a page refresh (Resume), and retry a
--   single failed section without touching the others or restarting the
--   batch. Orchestration itself stays entirely client-side (one
--   generate-documentation invocation per section, sequential) — this table
--   only persists progress, never runs the loop server-side, which is what
--   keeps every individual Edge Function invocation's execution time
--   independent of how many total sections exist.
--
-- RLS mirrors the existing workspace-membership pattern (documentation_
-- sections / documentation_section_versions, see 20260722153900_add_
-- documentation_engine.sql) via the SECURITY DEFINER
-- public.is_workspace_member() helper, joined through projects.workspace_id.

create table if not exists public.project_analysis_cache (
  project_id uuid primary key references public.projects(id) on delete cascade,
  -- Fingerprint of the project state (files + plan + db + deployments) this
  -- analysis was computed from — see src/lib/documentation/hash.ts for the
  -- client-side algorithm this is compared against.
  fingerprint text not null,
  -- Derived facts: { title, prompt, stack, type, is_multipage, framework,
  -- fileTree, routes, apiRoutes, envVars, authFiles, components,
  -- packageJsonSummary, readmeExcerpt, database, deployments, domains,
  -- githubConnected, fileCount }
  analysis jsonb not null,
  computed_at timestamptz not null default now()
);

create table if not exists public.documentation_generation_jobs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed')),
  -- Ordered target list for this run (the core sections that were
  -- missing/outdated when Generate All was started, or all of them if the
  -- user chose "force regenerate all").
  section_keys text[] not null default '{}',
  -- { [section_key]: { status: 'pending'|'running'|'completed'|'failed',
  --                     attempts: number, error?: string, completed_at?: string } }
  section_status jsonb not null default '{}',
  fingerprint text,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_analysis_cache enable row level security;
alter table public.documentation_generation_jobs enable row level security;

create policy "Workspace members can view project analysis cache"
  on public.project_analysis_cache for select
  using (exists (select 1 from public.projects p where p.id = project_analysis_cache.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can insert project analysis cache"
  on public.project_analysis_cache for insert
  with check (exists (select 1 from public.projects p where p.id = project_analysis_cache.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can update project analysis cache"
  on public.project_analysis_cache for update
  using (exists (select 1 from public.projects p where p.id = project_analysis_cache.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can delete project analysis cache"
  on public.project_analysis_cache for delete
  using (exists (select 1 from public.projects p where p.id = project_analysis_cache.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can view documentation generation jobs"
  on public.documentation_generation_jobs for select
  using (exists (select 1 from public.projects p where p.id = documentation_generation_jobs.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can insert documentation generation jobs"
  on public.documentation_generation_jobs for insert
  with check (exists (select 1 from public.projects p where p.id = documentation_generation_jobs.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can update documentation generation jobs"
  on public.documentation_generation_jobs for update
  using (exists (select 1 from public.projects p where p.id = documentation_generation_jobs.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can delete documentation generation jobs"
  on public.documentation_generation_jobs for delete
  using (exists (select 1 from public.projects p where p.id = documentation_generation_jobs.project_id and public.is_workspace_member(p.workspace_id)));

create or replace function public.touch_documentation_generation_job_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documentation_generation_jobs_touch_updated_at on public.documentation_generation_jobs;
create trigger documentation_generation_jobs_touch_updated_at
  before update on public.documentation_generation_jobs
  for each row execute function public.touch_documentation_generation_job_updated_at();
