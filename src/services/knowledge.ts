// path: src/services/knowledge.ts
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceKnowledge {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchKnowledge(workspaceId: string): Promise<WorkspaceKnowledge[]> {
  const { data, error } = await supabase
    .from("workspace_knowledge")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkspaceKnowledge[];
}

export async function addKnowledge(
  workspaceId: string,
  userId: string,
  title: string,
  content: string,
): Promise<WorkspaceKnowledge> {
  const { data, error } = await supabase
    .from("workspace_knowledge")
    .insert({ workspace_id: workspaceId, created_by: userId, title, content } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceKnowledge;
}

export async function updateKnowledge(id: string, title: string, content: string): Promise<WorkspaceKnowledge> {
  const { data, error } = await supabase
    .from("workspace_knowledge")
    .update({ title, content, updated_at: new Date().toISOString() } as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceKnowledge;
}

export async function deleteKnowledge(id: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_knowledge")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
