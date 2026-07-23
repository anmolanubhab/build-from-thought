-- Adds a lightweight "folder" grouping to projects, backing the
-- ProjectActionMenu "Move to Folder" action. Nullable text rather than a
-- separate folders table: folders here are just free-text labels a user
-- assigns to projects within their workspace, created on the fly from the
-- "Move to Folder" dialog (pick an existing label or type a new one).
alter table public.projects add column if not exists folder text;
create index if not exists projects_workspace_folder_idx on public.projects (workspace_id, folder);
