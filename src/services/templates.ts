// path: src/services/templates.ts
import { supabase } from "@/integrations/supabase/client";
import type { PageData } from "@/lib/projects";

export interface WorkspaceTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  seed_prompt: string | null;
  seed_html: string | null;
  seed_css: string | null;
  seed_react_code: string | null;
  seed_pages: PageData[] | null;
  created_by: string;
  created_at: string;
}

/** Lightweight project shape used only for the "save as template" picker. */
export interface TemplateSourceProject {
  id: string;
  title: string;
  prompt: string;
  html: string | null;
  css: string | null;
  react_code: string | null;
  pages: PageData[] | null;
}

export async function fetchTemplates(workspaceId: string): Promise<WorkspaceTemplate[]> {
  const { data, error } = await supabase
    .from("workspace_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkspaceTemplate[];
}

/** Lightweight project list for the "save as template" picker — just the columns needed to seed a template. */
export async function fetchWorkspaceProjectsForTemplates(workspaceId: string): Promise<TemplateSourceProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, prompt, html, css, react_code, pages")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TemplateSourceProject[];
}

/** Copies a project's content into a new named template. RLS allows any workspace member to insert. */
export async function saveProjectAsTemplate(
  workspaceId: string,
  userId: string,
  name: string,
  description: string,
  project: { prompt: string; html: string | null; css: string | null; react_code: string | null; pages: unknown }
): Promise<WorkspaceTemplate> {
  const { data, error } = await supabase
    .from("workspace_templates")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name,
      description: description || null,
      seed_prompt: project.prompt,
      seed_html: project.html,
      seed_css: project.css,
      seed_react_code: project.react_code,
      seed_pages: project.pages,
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as WorkspaceTemplate;
}

/** RLS restricts this to the template's creator or the workspace owner. */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_templates")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
