-- path: supabase/migrations/20260723082859_index_documentation_generation_jobs_created_by.sql
-- Performance advisor flagged documentation_generation_jobs.created_by (FK to
-- auth.users) as missing a covering index, same class of finding as
-- 20260722181329_harden_documentation_engine.sql fixed for
-- documentation_section_versions.created_by.

create index if not exists documentation_generation_jobs_created_by_idx
  on public.documentation_generation_jobs (created_by);
