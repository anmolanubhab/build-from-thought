import { supabase } from "@/integrations/supabase/client";

export async function createDeployment(projectId: string) {
  const { data, error } = await supabase
    .from("deployments")
    .insert({ project_id: projectId, status: "pending" } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDeployment(id: string, updates: { deploy_url?: string; status?: string }) {
  const { data, error } = await supabase
    .from("deployments")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDeployments(projectId: string) {
  const { data, error } = await supabase
    .from("deployments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
