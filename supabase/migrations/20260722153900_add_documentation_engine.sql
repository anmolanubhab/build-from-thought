-- path: supabase/migrations/20260722153900_add_documentation_engine.sql
-- AI Documentation Center: a modular "Documentation Engine".
--
-- Documentation is modeled as one row per (project, section_key) rather than
-- one hardcoded table/column per document type. `section_key` is an open
-- text value driven entirely by the frontend/edge-function registries
-- (src/lib/documentation/registry.ts, supabase/functions/_shared/doc-sections.ts)
-- — adding a new document type (e.g. a future "Security Audit" doc) never
-- requires a schema migration, only a new registry entry.
--
-- documentation_sections holds the CURRENT content for each section.
-- documentation_section_versions is an append-only history of every AI
-- generation, manual edit checkpoint, merge, and restore — it powers the
-- "Version History" UI (compare/restore/track AI updates).
--
-- RLS mirrors the existing workspace-membership pattern used by
-- project_versions/deployments/etc. (see 20260720133500_fix_workspace_
-- membership_rls_recursion.sql) via the SECURITY DEFINER
-- public.is_workspace_member() helper, joined through projects.workspace_id.

create table if not exists public.documentation_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_key text not null,
  title text not null default '',
  content_md text not null default '',
  -- Structured payload for sections that carry more than prose (e.g. viva_mode's
  -- categorized Q&A list, ai_explain's audience). Optional — most sections leave
  -- this null and rely on content_md alone.
  content_json jsonb,
  -- 'manual'   — never AI-generated, or user has since hand-edited it
  -- 'ai'       — last written by "Generate"/"Regenerate" verbatim
  -- 'merge'    — last written by "Merge AI Changes" (AI update + preserved manual edits)
  source text not null default 'manual' check (source in ('manual', 'ai', 'merge')),
  -- true once a human has typed into the editor — regeneration must go through
  -- the merge-aware path instead of silently overwriting their edits.
  has_manual_edits boolean not null default false,
  -- Fingerprint of the project (files + plan + db schema) at the moment this
  -- section was last (re)generated. Compared against the project's current
  -- fingerprint client-side to detect "outdated" sections for Auto Sync.
  source_fingerprint text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, section_key)
);

create table if not exists public.documentation_section_versions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.documentation_sections(id) on delete cascade,
  -- Denormalized so version history / RLS can be queried without a join.
  project_id uuid not null references public.projects(id) on delete cascade,
  section_key text not null,
  title text not null default '',
  content_md text not null default '',
  content_json jsonb,
  source text not null default 'manual' check (source in ('manual_edit', 'ai_generate', 'merge', 'restore')),
  summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.documentation_sections enable row level security;
alter table public.documentation_section_versions enable row level security;

create index if not exists documentation_sections_project_idx
  on public.documentation_sections (project_id);

create index if not exists documentation_section_versions_section_idx
  on public.documentation_section_versions (section_id, created_at desc);

create index if not exists documentation_section_versions_project_idx
  on public.documentation_section_versions (project_id);

-- documentation_sections: full CRUD for workspace members (same trust boundary
-- as editing the project's own files/prompts).
create policy "Workspace members can view documentation sections"
  on public.documentation_sections for select
  using (exists (select 1 from public.projects p where p.id = documentation_sections.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can insert documentation sections"
  on public.documentation_sections for insert
  with check (exists (select 1 from public.projects p where p.id = documentation_sections.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can update documentation sections"
  on public.documentation_sections for update
  using (exists (select 1 from public.projects p where p.id = documentation_sections.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can delete documentation sections"
  on public.documentation_sections for delete
  using (exists (select 1 from public.projects p where p.id = documentation_sections.project_id and public.is_workspace_member(p.workspace_id)));

-- documentation_section_versions: append-only from the client's point of view
-- (insert + select + delete-for-cleanup; no update — history must stay honest).
create policy "Workspace members can view documentation versions"
  on public.documentation_section_versions for select
  using (exists (select 1 from public.projects p where p.id = documentation_section_versions.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can insert documentation versions"
  on public.documentation_section_versions for insert
  with check (exists (select 1 from public.projects p where p.id = documentation_section_versions.project_id and public.is_workspace_member(p.workspace_id)));

create policy "Workspace members can delete documentation versions"
  on public.documentation_section_versions for delete
  using (exists (select 1 from public.projects p where p.id = documentation_section_versions.project_id and public.is_workspace_member(p.workspace_id)));

-- Keep updated_at honest on every content change (autosave, AI generation, merges).
create or replace function public.touch_documentation_section_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documentation_sections_touch_updated_at on public.documentation_sections;
create trigger documentation_sections_touch_updated_at
  before update on public.documentation_sections
  for each row execute function public.touch_documentation_section_updated_at();
