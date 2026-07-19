import { supabase } from "@/integrations/supabase/client";
import type { Project, ProjectType, PageData } from "@/lib/projects";

export async function fetchUserProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Project[];
}

export async function insertProject(project: {
  user_id: string;
  title: string;
  type: ProjectType;
  prompt: string;
  slug: string;
  html?: string;
  css?: string;
  react_code?: string;
  is_multipage?: boolean;
  pages?: PageData[] | null;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Project;
}

export async function updateProject(id: string, updates: Partial<Pick<Project, "deployed_url" | "is_public" | "title">> & { pages?: PageData[] | null; is_multipage?: boolean }): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchProjectBySlug(slug: string): Promise<Project & { creator?: { display_name: string; username: string } }> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, profiles!projects_user_id_fkey(display_name, username)")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(error.message);

  const raw = data as any;
  return {
    ...raw,
    creator: raw.profiles ?? undefined,
    profiles: undefined,
  };
}

export async function incrementViewCount(id: string): Promise<void> {
  try {
    const { data: project } = await supabase
      .from("projects")
      .select("view_count")
      .eq("id", id)
      .single();

    if (project) {
      await supabase
        .from("projects")
        .update({ view_count: (project as any).view_count + 1 } as any)
        .eq("id", id);
    }
  } catch {
    // Silently fail for view counting
  }
}

export async function remixProject(originalProject: Project, newUserId: string, newSlug: string): Promise<Project> {
  return insertProject({
    user_id: newUserId,
    title: `${originalProject.title} (Remix)`,
    type: originalProject.type,
    prompt: originalProject.prompt,
    slug: newSlug,
    html: originalProject.html,
    css: originalProject.css,
    react_code: originalProject.react_code,
    is_multipage: originalProject.is_multipage,
    pages: originalProject.pages,
  });
}
