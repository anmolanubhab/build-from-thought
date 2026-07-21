// path: src/services/designTokens.ts
import { supabase } from "@/integrations/supabase/client";

export interface DesignTokens {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
}

export interface DesignTokenSet {
  id: string;
  workspace_id: string;
  name: string;
  tokens: DesignTokens;
  created_by: string;
  created_at: string;
}

export async function fetchDesignTokenSets(workspaceId: string): Promise<DesignTokenSet[]> {
  const { data, error } = await supabase
    .from("workspace_design_tokens")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DesignTokenSet[];
}

export async function createDesignTokenSet(
  workspaceId: string,
  userId: string,
  name: string,
  tokens: DesignTokens
): Promise<DesignTokenSet> {
  const { data, error } = await supabase
    .from("workspace_design_tokens")
    .insert({ workspace_id: workspaceId, created_by: userId, name, tokens } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as DesignTokenSet;
}

export async function updateDesignTokenSet(
  id: string,
  name: string,
  tokens: DesignTokens
): Promise<DesignTokenSet> {
  const { data, error } = await supabase
    .from("workspace_design_tokens")
    .update({ name, tokens } as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as DesignTokenSet;
}

export async function deleteDesignTokenSet(id: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_design_tokens")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
