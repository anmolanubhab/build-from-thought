-- Workspaces (teams) and membership
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);

-- workspaces RLS
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid()));

CREATE POLICY "Owner can update workspace"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can delete workspace"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- workspace_members RLS
CREATE POLICY "Members can view workspace membership"
  ON public.workspace_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workspace_members me
    WHERE me.workspace_id = workspace_members.workspace_id AND me.user_id = auth.uid()
  ));

CREATE POLICY "Leave or owner can remove non-owner members"
  ON public.workspace_members FOR DELETE
  USING (
    role <> 'owner'
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members me
        WHERE me.workspace_id = workspace_members.workspace_id
          AND me.user_id = auth.uid()
          AND me.role = 'owner'
      )
    )
  );

-- Add workspace_id to projects (backfilled below, then made NOT NULL)
ALTER TABLE public.projects ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill: a personal workspace for every existing profile
INSERT INTO public.workspaces (name, owner_id)
SELECT COALESCE(NULLIF(TRIM(display_name), ''), 'My') || '''s Workspace', id
FROM public.profiles;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w;

UPDATE public.projects p
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = p.user_id
  AND p.workspace_id IS NULL;

ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;

-- Replace project-ownership RLS with workspace-membership RLS (full shared access)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Workspace members can view projects"
  ON public.projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Workspace members can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Workspace members can update projects"
  ON public.projects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Workspace members can delete projects"
  ON public.projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()));

-- project_versions
DROP POLICY IF EXISTS "Users can view versions of own projects" ON public.project_versions;
DROP POLICY IF EXISTS "Users can insert versions for own projects" ON public.project_versions;
DROP POLICY IF EXISTS "Users can update versions of own projects" ON public.project_versions;
DROP POLICY IF EXISTS "Users can delete versions of own projects" ON public.project_versions;

CREATE POLICY "Workspace members can view versions"
  ON public.project_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_versions.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can insert versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_versions.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can update versions"
  ON public.project_versions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_versions.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can delete versions"
  ON public.project_versions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_versions.project_id AND wm.user_id = auth.uid()
  ));

-- deployments
DROP POLICY IF EXISTS "Users can view deployments of own projects" ON public.deployments;
DROP POLICY IF EXISTS "Users can insert deployments for own projects" ON public.deployments;
DROP POLICY IF EXISTS "Users can update deployments of own projects" ON public.deployments;

CREATE POLICY "Workspace members can view deployments"
  ON public.deployments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = deployments.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can insert deployments"
  ON public.deployments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = deployments.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can update deployments"
  ON public.deployments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = deployments.project_id AND wm.user_id = auth.uid()
  ));

-- shared_projects (public "Anyone can view shared projects" policy is untouched)
DROP POLICY IF EXISTS "Users can insert shares for own projects" ON public.shared_projects;
DROP POLICY IF EXISTS "Users can delete shares for own projects" ON public.shared_projects;

CREATE POLICY "Workspace members can insert shares"
  ON public.shared_projects FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = shared_projects.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can delete shares"
  ON public.shared_projects FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = shared_projects.project_id AND wm.user_id = auth.uid()
  ));

-- project_domains
DROP POLICY IF EXISTS "Users can view domains of own projects" ON public.project_domains;
DROP POLICY IF EXISTS "Users can delete domains of own projects" ON public.project_domains;

CREATE POLICY "Workspace members can view domains"
  ON public.project_domains FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_domains.project_id AND wm.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can delete domains"
  ON public.project_domains FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_domains.project_id AND wm.user_id = auth.uid()
  ));

-- project_netlify_sites
DROP POLICY IF EXISTS "Users can view netlify sites of own projects" ON public.project_netlify_sites;

CREATE POLICY "Workspace members can view netlify sites"
  ON public.project_netlify_sites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = project_netlify_sites.project_id AND wm.user_id = auth.uid()
  ));

-- Auto-create a personal workspace for every new signup (extends the existing handle_new_user trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), ' ', '-')) || '-' || SUBSTRING(NEW.id::text, 1, 6)
  );

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Create a workspace + owner membership atomically
CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace public.workspaces;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (COALESCE(NULLIF(TRIM(p_name), ''), 'New Workspace'), auth.uid())
  RETURNING * INTO v_workspace;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, auth.uid(), 'owner');

  RETURN v_workspace;
END;
$$;

-- Join a workspace via its shareable invite code
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(p_code TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace public.workspaces;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_workspace FROM public.workspaces WHERE invite_code = p_code;

  IF v_workspace.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, auth.uid(), 'member')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN v_workspace;
END;
$$;
