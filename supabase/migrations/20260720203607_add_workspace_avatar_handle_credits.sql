-- Avatar, handle, and member-default credit limit for workspaces.
-- All three columns are nullable so existing rows are unaffected; updates
-- go through the existing "Owner can update workspace" RLS policy, no new
-- policy needed on the workspaces table itself.
ALTER TABLE public.workspaces ADD COLUMN avatar_url TEXT;
ALTER TABLE public.workspaces ADD COLUMN handle TEXT UNIQUE CHECK (handle ~ '^[a-z0-9-]{3,50}$');
ALTER TABLE public.workspaces ADD COLUMN default_member_credit_limit INTEGER
  CHECK (default_member_credit_limit IS NULL OR default_member_credit_limit > 0);

-- Storage bucket for workspace avatars. Public read (avatars are shown in
-- the sidebar/settings UI); writes restricted to the workspace owner via
-- the existing is_workspace_owner() helper, keyed off the {workspace_id}/...
-- path convention.
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace-avatars', 'workspace-avatars', true);

CREATE POLICY "Anyone can view workspace avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-avatars');

CREATE POLICY "Owner can upload workspace avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'workspace-avatars' AND public.is_workspace_owner(((storage.foldername(name))[1])::uuid));

CREATE POLICY "Owner can update workspace avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'workspace-avatars' AND public.is_workspace_owner(((storage.foldername(name))[1])::uuid));

CREATE POLICY "Owner can delete workspace avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'workspace-avatars' AND public.is_workspace_owner(((storage.foldername(name))[1])::uuid));

-- Extend join_workspace_by_code: when a NEW member joins (not a repeat call
-- for an existing membership — detected via the ON CONFLICT DO NOTHING
-- outcome) and the workspace has a default_member_credit_limit set, apply
-- it to that member's profile once, at join time. No retroactive changes
-- to existing members, no live shared pool.
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(p_code TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace public.workspaces;
  v_inserted UUID;
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
  ON CONFLICT (workspace_id, user_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL AND v_workspace.default_member_credit_limit IS NOT NULL THEN
    UPDATE public.profiles
    SET credits_daily_limit = v_workspace.default_member_credit_limit,
        credits_remaining = v_workspace.default_member_credit_limit
    WHERE id = auth.uid();
  END IF;

  RETURN v_workspace;
END;
$$;
