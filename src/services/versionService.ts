import { supabase } from "@/integrations/supabase/client";

export async function createVersion(projectId: string, code: string) {
  const { data, error } = await supabase
    .from("project_versions")
    .insert({ project_id: projectId, code } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getVersions(projectId: string) {
  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVersion(versionId: string) {
  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
