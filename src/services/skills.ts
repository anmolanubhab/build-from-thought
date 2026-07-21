// path: src/services/skills.ts
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceSkill {
  id: string;
  workspace_id: string;
  name: string;
  instructions: string;
  created_by: string;
  created_at: string;
}

export async function fetchSkills(workspaceId: string): Promise<WorkspaceSkill[]> {
  const { data, error } = await supabase
    .from("workspace_skills")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkspaceSkill[];
}

export async function addSkill(
  workspaceId: string,
  userId: string,
  name: string,
  instructions: string,
): Promise<WorkspaceSkill> {
  const { data, error } = await supabase
    .from("workspace_skills")
    .insert({ workspace_id: workspaceId, created_by: userId, name, instructions } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceSkill;
}

export async function updateSkill(id: string, name: string, instructions: string): Promise<WorkspaceSkill> {
  const { data, error } = await supabase
    .from("workspace_skills")
    .update({ name, instructions } as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceSkill;
}

export async function deleteSkill(id: string): Promise<void> {
  const { error } = await supabase.from("workspace_skills").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
