-- path: supabase/migrations/20260722181329_harden_documentation_engine.sql
-- Follow-up hardening for the Documentation Engine, per Supabase advisor findings
-- after the initial migration:
--   1. function_search_path_mutable (WARN): touch_documentation_section_updated_at
--      had no fixed search_path, which is a well-known SECURITY DEFINER/trigger
--      hijack vector if a bad actor could ever inject objects earlier in the path.
--   2. Missing covering index on documentation_section_versions.created_by (FK to
--      auth.users) — flagged as a performance advisory.
--
-- This migration was applied directly to the live project (version
-- 20260722181329) but the file was never committed to the repo — this commit
-- backfills it so `supabase/migrations` matches what's actually deployed.
-- Re-applying is a no-op (create-or-replace / if-not-exists throughout).

create or replace function public.touch_documentation_section_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists documentation_section_versions_created_by_idx
  on public.documentation_section_versions (created_by);
