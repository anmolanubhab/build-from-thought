// path: src/services/workspaces.ts
import { supabase } from "@/integrations/supabase/client";
import type { Workspace, WorkspaceMember } from "@/lib/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";

export async function fetchUserWorkspaces(): Promise<Workspace[]> {
  // RLS already restricts this to workspaces the caller is a member of.
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Workspace[];
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const { data, error } = await supabase.rpc("create_workspace", { p_name: name });
  if (error) throw new Error(error.message);
  return data as unknown as Workspace;
}

export async function joinWorkspaceByCode(code: string): Promise<Workspace> {
  const { data, error } = await supabase.rpc("join_workspace_by_code", { p_code: code });
  if (error) throw new Error(error.message);
  return data as unknown as Workspace;
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (members ?? []) as unknown as WorkspaceMember[];

  const userIds = rows.map((m) => m.user_id);
  if (userIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return rows.map((m) => ({ ...m, profile: profileMap.get(m.user_id) ?? null }));
}

/** Removes a member row. RLS allows this for either a self-leave or an owner removing a non-owner. */
export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/** RLS restricts this to the workspace's owner. */
export async function updateWorkspaceName(workspaceId: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name } as any)
    .eq("id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Workspace;
}

/**
 * Resolves which workspace a client-side action should use when there's no
 * explicit "current workspace" already in scope (e.g. remixing a shared
 * project). Prefers the locally-remembered current workspace if it's still
 * valid, otherwise falls back to the user's first (typically personal) one.
 */
export async function resolveDefaultWorkspaceId(): Promise<string> {
  const stored = window.localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY);
  if (stored) {
    const { data } = await supabase.from("workspaces").select("id").eq("id", stored).maybeSingle();
    if (data) return stored;
  }

  const workspaces = await fetchUserWorkspaces();
  if (workspaces.length === 0) throw new Error("No workspace found for this account");
  return workspaces[0].id;
}
