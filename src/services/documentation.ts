// path: src/services/documentation.ts
//
// Documentation Engine data layer: CRUD for documentation_sections, version
// history, and the generate-documentation edge function call. Mirrors the
// draft/publish split already used for project code (services/versions.ts) —
// AI generation and manual edits both flow through the same "current
// section" row, with every meaningful change appended to
// documentation_section_versions for history/compare/restore.

import { supabase } from "@/integrations/supabase/client";
import type {
  DocumentationSection, DocumentationSectionVersion, DocSectionKey, DocSource,
  DocVersionSource, GenerationMode, ExplainAudience, VivaLevel, GenerateDocumentationResult,
} from "@/lib/documentation/types";

/** supabase-js collapses non-2xx edge function responses to a generic message —
 *  the real `{ error }` JSON body is only reachable via error.context. Same
 *  pattern as services/database.ts. */
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      const msg = (body as { message?: unknown; error?: unknown } | null)?.message ?? (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // Response body wasn't JSON — fall through.
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

export async function fetchSections(projectId: string): Promise<DocumentationSection[]> {
  const { data, error } = await supabase
    .from("documentation_sections")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentationSection[];
}

export async function fetchVersions(sectionId: string): Promise<DocumentationSectionVersion[]> {
  const { data, error } = await supabase
    .from("documentation_section_versions")
    .select("*")
    .eq("section_id", sectionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentationSectionVersion[];
}

async function insertVersion(
  section: DocumentationSection,
  source: DocVersionSource,
  summary: string | null,
): Promise<DocumentationSectionVersion> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("documentation_section_versions")
    .insert({
      section_id: section.id,
      project_id: section.project_id,
      section_key: section.section_key,
      title: section.title,
      content_md: section.content_md,
      content_json: section.content_json as any,
      source,
      summary,
      created_by: user?.id ?? null,
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as DocumentationSectionVersion;
}

/** Manual save (autosave from the editor, or an explicit "Save"). Always marks
 *  the section as having manual edits so a later regenerate must go through
 *  the merge-aware path instead of silently overwriting the user's writing. */
export async function saveManualEdit(
  projectId: string,
  sectionKey: DocSectionKey,
  content: { title: string; content_md: string },
  opts: { checkpoint?: boolean; summary?: string } = {},
): Promise<DocumentationSection> {
  const { data, error } = await supabase
    .from("documentation_sections")
    .upsert(
      {
        project_id: projectId,
        section_key: sectionKey,
        title: content.title,
        content_md: content.content_md,
        source: "manual" as DocSource,
        has_manual_edits: true,
      } as any,
      { onConflict: "project_id,section_key" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  const section = data as unknown as DocumentationSection;
  if (opts.checkpoint) await insertVersion(section, "manual_edit", opts.summary ?? "Manual edit");
  return section;
}

export interface GenerateSectionParams {
  projectId: string;
  sectionKey: DocSectionKey;
  mode: GenerationMode;
  existingMarkdown?: string;
  audience?: ExplainAudience;
  levels?: VivaLevel[];
  /** Current project fingerprint (see lib/documentation/hash.ts) — stored on
   *  the section so Auto Sync can later tell it's up to date. */
  fingerprint: string;
}

/** Calls the AI generator, then persists the result as the section's current
 *  content and appends a version-history entry. */
export async function generateSection(params: GenerateSectionParams): Promise<DocumentationSection> {
  const { data, error } = await supabase.functions.invoke("generate-documentation", {
    body: {
      project_id: params.projectId,
      section_key: params.sectionKey,
      mode: params.mode,
      existing_markdown: params.existingMarkdown,
      audience: params.audience,
      levels: params.levels,
    },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Documentation generation failed"));
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

  const result = data as GenerateDocumentationResult;
  const source: DocSource = params.mode === "merge" ? "merge" : "ai";

  const { data: saved, error: saveError } = await supabase
    .from("documentation_sections")
    .upsert(
      {
        project_id: params.projectId,
        section_key: params.sectionKey,
        title: result.title,
        content_md: result.content_md,
        content_json: (result.content_json ?? null) as any,
        source,
        has_manual_edits: false,
        source_fingerprint: params.fingerprint,
        generated_at: new Date().toISOString(),
      } as any,
      { onConflict: "project_id,section_key" },
    )
    .select()
    .single();
  if (saveError) throw new Error(saveError.message);

  const section = saved as unknown as DocumentationSection;
  await insertVersion(section, params.mode === "merge" ? "merge" : "ai_generate", `AI ${params.mode}`);
  return section;
}

/** Restores an older version as the section's current content (recorded as its own version entry, so restoring is itself undoable). */
export async function restoreVersion(
  section: DocumentationSection,
  version: DocumentationSectionVersion,
): Promise<DocumentationSection> {
  const { data, error } = await supabase
    .from("documentation_sections")
    .update({
      title: version.title,
      content_md: version.content_md,
      content_json: version.content_json as any,
      source: "manual" as DocSource,
      has_manual_edits: true,
    } as any)
    .eq("id", section.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const restored = data as unknown as DocumentationSection;
  await insertVersion(restored, "restore", `Restored version from ${new Date(version.created_at).toLocaleString()}`);
  return restored;
}

/** "Keep Manual Changes" — dismisses the outdated flag without touching content,
 *  by advancing the stored fingerprint to the project's current state. */
export async function acknowledgeUpToDate(section: DocumentationSection, fingerprint: string): Promise<DocumentationSection> {
  const { data, error } = await supabase
    .from("documentation_sections")
    .update({ source_fingerprint: fingerprint } as any)
    .eq("id", section.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as DocumentationSection;
}

/** True when a section was AI-generated/merged and the project has changed since. Sections that were never AI-generated have no baseline to compare and are never flagged. */
export function isSectionOutdated(section: DocumentationSection | undefined, currentFingerprint: string): boolean {
  if (!section || !section.source_fingerprint) return false;
  return section.source_fingerprint !== currentFingerprint;
}
