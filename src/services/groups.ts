// path: src/services/groups.ts
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceGroup {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export async function fetchGroups(workspaceId: string): Promise<WorkspaceGroup[]> {
  const { data, error } = await supabase
    .from("workspace_groups")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkspaceGroup[];
}

export async function fetchGroupMembers(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("workspace_group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { user_id: string }[]).map((r) => r.user_id);
}

/** RLS restricts this to the workspace's owner. */
export async function createGroup(workspaceId: string, name: string): Promise<WorkspaceGroup> {
  const { data, error } = await supabase
    .from("workspace_groups")
    .insert({ workspace_id: workspaceId, name } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceGroup;
}

/** RLS restricts this to the workspace's owner. */
export async function renameGroup(groupId: string, name: string): Promise<WorkspaceGroup> {
  const { data, error } = await supabase
    .from("workspace_groups")
    .update({ name } as any)
    .eq("id", groupId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceGroup;
}

/** RLS restricts this to the workspace's owner. Group members cascade-delete via FK. */
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_groups")
    .delete()
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

/** RLS restricts this to the workspace's owner. */
export async function addGroupMember(groupId: string, workspaceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_group_members")
    .insert({ group_id: groupId, workspace_id: workspaceId, user_id: userId } as any);

  if (error) throw new Error(error.message);
}

/** RLS restricts this to the workspace's owner. */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
