// path: src/services/versions.ts
import { supabase } from "@/integrations/supabase/client";
import type { PageData, Project } from "@/lib/projects";

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  status: "draft" | "live" | "archived";
  html: string | null;
  css: string | null;
  react_code: string | null;
  pages: PageData[] | null;
  files: Record<string, string> | null;
  preview_url: string | null;
  summary: string | null;
  published_at: string | null;
  created_at: string;
}

export interface VersionContent {
  html: string;
  css: string;
  react_code: string;
  pages?: PageData[] | null;
  files?: Record<string, string> | null;
}

/** Creates the initial "live" version snapshot right after a project is first generated. */
export async function createBaselineVersion(projectId: string, content: VersionContent): Promise<ProjectVersion> {
  const { data, error } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      version_number: 1,
      status: "live",
      html: content.html,
      css: content.css,
      react_code: content.react_code,
      pages: (content.pages ?? null) as any,
      files: (content.files ?? null) as any,
      published_at: new Date().toISOString(),
      summary: "Initial generation",
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ProjectVersion;
}

/** Fetches the current open draft for a project (if any). */
export async function fetchOpenDraft(projectId: string): Promise<ProjectVersion | null> {
  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ProjectVersion) ?? null;
}

/** Creates a new draft version. */
export async function createDraft(projectId: string, content: VersionContent, summary: string): Promise<ProjectVersion> {
  const { data: existing } = await supabase
    .from("project_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = ((existing as any)?.version_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      version_number: nextNumber,
      status: "draft",
      html: content.html,
      css: content.css,
      react_code: content.react_code,
      pages: (content.pages ?? null) as any,
      files: (content.files ?? null) as any,
      summary,
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ProjectVersion;
}

/** Updates an existing draft's content (keeps successive edits in the same draft until published). */
export async function updateDraft(versionId: string, content: VersionContent, summary: string): Promise<ProjectVersion> {
  const { data, error } = await supabase
    .from("project_versions")
    .update({
      html: content.html,
      css: content.css,
      react_code: content.react_code,
      pages: (content.pages ?? null) as any,
      files: (content.files ?? null) as any,
      summary,
    } as any)
    .eq("id", versionId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ProjectVersion;
}

export async function discardDraft(versionId: string): Promise<void> {
  const { error } = await supabase.from("project_versions").delete().eq("id", versionId).eq("status", "draft");
  if (error) throw new Error(error.message);
}

/** Publishes a draft, or rolls back to an old archived version - both use the same DB function. */
export async function publishVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc("publish_project_version", { p_version_id: versionId });
  if (error) throw new Error(error.message);
}

export async function fetchVersionHistory(projectId: string): Promise<ProjectVersion[]> {
  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectVersion[];
}

export interface PreviewDeployResult {
  url: string;
  status: string;
}

/** Deploys a specific draft version to a real shareable Vercel preview URL. */
export async function createPreviewDeployment(projectId: string, versionId: string): Promise<PreviewDeployResult> {
  const { data, error } = await supabase.functions.invoke("vercel-deploy", {
    body: { project_id: projectId, target: "preview", version_id: versionId },
  });
  if (error) throw new Error(error.message || "Preview deploy failed");
  if (data?.error) throw new Error(data.error);
  return data as PreviewDeployResult;
}
