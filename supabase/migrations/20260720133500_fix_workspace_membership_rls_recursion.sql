-- The "Members can view workspace membership" and "Leave or owner can remove
-- non-owner members" policies on workspace_members queried workspace_members
-- from within their own USING clause. Postgres re-applies RLS to that inner
-- query too, which re-triggers the same policy — infinite recursion. Every
-- other policy that checked workspace_members (workspaces, projects, and the
-- project_id-joined tables) inherited the same failure, since evaluating them
-- requires evaluating workspace_members' own (recursive) policy.
--
-- Fix: move the membership/ownership check into SECURITY DEFINER helper
-- functions. Those run with the function owner's privileges, which bypasses
-- RLS for their internal query, breaking the recursive cycle.

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- workspaces
DROP POLICY IF EXISTS "Members can view their workspaces" ON public.workspaces;
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));

-- workspace_members
DROP POLICY IF EXISTS "Members can view workspace membership" ON public.workspace_members;
CREATE POLICY "Members can view workspace membership"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Leave or owner can remove non-owner members" ON public.workspace_members;
CREATE POLICY "Leave or owner can remove non-owner members"
  ON public.workspace_members FOR DELETE
  USING (
    role <> 'owner'
    AND (user_id = auth.uid() OR public.is_workspace_owner(workspace_id))
  );

-- projects
DROP POLICY IF EXISTS "Workspace members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Workspace members can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Workspace members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Workspace members can delete projects" ON public.projects;

CREATE POLICY "Workspace members can view projects"
  ON public.projects FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can update projects"
  ON public.projects FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can delete projects"
  ON public.projects FOR DELETE
  USING (public.is_workspace_member(workspace_id));

-- project_versions
DROP POLICY IF EXISTS "Workspace members can view versions" ON public.project_versions;
DROP POLICY IF EXISTS "Workspace members can insert versions" ON public.project_versions;
DROP POLICY IF EXISTS "Workspace members can update versions" ON public.project_versions;
DROP POLICY IF EXISTS "Workspace members can delete versions" ON public.project_versions;

CREATE POLICY "Workspace members can view versions"
  ON public.project_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can insert versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can update versions"
  ON public.project_versions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can delete versions"
  ON public.project_versions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND public.is_workspace_member(p.workspace_id)));

-- deployments
DROP POLICY IF EXISTS "Workspace members can view deployments" ON public.deployments;
DROP POLICY IF EXISTS "Workspace members can insert deployments" ON public.deployments;
DROP POLICY IF EXISTS "Workspace members can update deployments" ON public.deployments;

CREATE POLICY "Workspace members can view deployments"
  ON public.deployments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = deployments.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can insert deployments"
  ON public.deployments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = deployments.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can update deployments"
  ON public.deployments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = deployments.project_id AND public.is_workspace_member(p.workspace_id)));

-- shared_projects
DROP POLICY IF EXISTS "Workspace members can insert shares" ON public.shared_projects;
DROP POLICY IF EXISTS "Workspace members can delete shares" ON public.shared_projects;

CREATE POLICY "Workspace members can insert shares"
  ON public.shared_projects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = shared_projects.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can delete shares"
  ON public.shared_projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = shared_projects.project_id AND public.is_workspace_member(p.workspace_id)));

-- project_domains
DROP POLICY IF EXISTS "Workspace members can view domains" ON public.project_domains;
DROP POLICY IF EXISTS "Workspace members can delete domains" ON public.project_domains;

CREATE POLICY "Workspace members can view domains"
  ON public.project_domains FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_domains.project_id AND public.is_workspace_member(p.workspace_id)));

CREATE POLICY "Workspace members can delete domains"
  ON public.project_domains FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_domains.project_id AND public.is_workspace_member(p.workspace_id)));

-- project_netlify_sites
DROP POLICY IF EXISTS "Workspace members can view netlify sites" ON public.project_netlify_sites;

CREATE POLICY "Workspace members can view netlify sites"
  ON public.project_netlify_sites FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_netlify_sites.project_id AND public.is_workspace_member(p.workspace_id)));
