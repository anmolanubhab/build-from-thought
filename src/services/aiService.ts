import { supabase } from "@/integrations/supabase/client";

export async function saveGeneration(params: {
  user_id: string;
  project_id?: string;
  prompt: string;
  response?: string;
  model?: string;
}) {
  const { data, error } = await supabase
    .from("ai_generations")
    .insert(params as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getGenerations(userId: string, projectId?: string) {
  let query = supabase
    .from("ai_generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
