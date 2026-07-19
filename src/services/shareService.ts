import { supabase } from "@/integrations/supabase/client";

export async function createShare(projectId: string, slug: string) {
  const { data, error } = await supabase
    .from("shared_projects")
    .insert({ project_id: projectId, slug } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getShareBySlug(slug: string) {
  const { data, error } = await supabase
    .from("shared_projects")
    .select("*, projects(*)")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteShare(id: string) {
  const { error } = await supabase.from("shared_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
