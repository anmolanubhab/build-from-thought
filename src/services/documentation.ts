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
  DocumentationGenerationJob, SectionStatusMap,
} from "@/lib/documentation/types";

/** Thrown by generateSection — carries the HTTP status the edge function
 *  responded with (when available) so callers like withRetry/documentationBatch
 *  can tell a transient failure (429/500/502/503/504) from a permanent one
 *  (400/401/403/404) without re-parsing the message string. */
export class DocGenerationError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "DocGenerationError";
    this.status = status;
  }
}

/** supabase-js collapses non-2xx edge function responses to a generic message —
 *  the real `{ error }` JSON body (and the real status code) is only reachable
 *  via error.context. Same pattern as services/database.ts. */
async function describeFunctionError(error: unknown, fallback: string): Promise<{ message: string; status?: number }> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    const status = (context as Response).status;
    try {
      const body = await (context as Response).json();
      const msg = (body as { message?: unknown; error?: unknown } | null)?.message ?? (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.trim()) return { message: msg, status };
    } catch {
      // Response body wasn't JSON — fall through.
    }
    return { message: (error as { message?: string } | null)?.message || fallback, status };
  }
  return { message: (error as { message?: string } | null)?.message || fallback };
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
 *  content and appends a version-history entry. Sends the project fingerprint
 *  so the edge function can reuse its cached project analysis instead of
 *  re-scanning the project's files on every call (project_analysis_cache). */
export async function generateSection(params: GenerateSectionParams): Promise<DocumentationSection> {
  const { data, error } = await supabase.functions.invoke("generate-documentation", {
    body: {
      project_id: params.projectId,
      section_key: params.sectionKey,
      mode: params.mode,
      existing_markdown: params.existingMarkdown,
      audience: params.audience,
      levels: params.levels,
      project_fingerprint: params.fingerprint,
    },
  });
  if (error) {
    const info = await describeFunctionError(error, "Documentation generation failed");
    throw new DocGenerationError(info.message, info.status);
  }
  if ((data as any)?.error) throw new DocGenerationError((data as any).message || (data as any).error);

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

// ---------------------------------------------------------------------------
// Retry with backoff — used by the Generate All batch orchestrator
// (src/services/documentationBatch.ts) so a transient Gemini 429/500/502/
// 503/504 or network timeout doesn't fail the whole batch; a real 4xx
// (validation/auth) fails immediately since retrying can't fix it.
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Total attempts including the first — default 3 (1 try + 2 retries). */
  maxAttempts?: number;
  /** Delay before each retry, ms. Last entry repeats if maxAttempts exceeds its length. */
  backoffMs?: number[];
  retryableStatuses?: number[];
}

const DEFAULT_BACKOFF_MS = [2000, 6000, 15000];
const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

function isRetryableError(err: unknown, retryableStatuses: number[]): boolean {
  const status = (err as { status?: number } | null)?.status;
  // No status usually means the failure happened before a response came back
  // at all (network drop, CORS, client-side timeout) — treat those as
  // retryable too, since they're not a rejection of the request's content.
  if (typeof status !== "number") return true;
  return retryableStatuses.includes(status);
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const maxAttempts = opts.maxAttempts ?? backoffMs.length + 1;
  const retryableStatuses = opts.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const attemptsLeft = maxAttempts - attempt - 1;
      if (attemptsLeft <= 0 || !isRetryableError(err, retryableStatuses)) throw err;
      const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Unreachable (loop always returns or throws), but keeps TS happy.
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Generate All job persistence — one row per project in
// documentation_generation_jobs (see migration 20260723081628). A live
// status board, not a history table: re-reading it is how "Resume" works
// after a closed tab, and it's what lets Retry touch only one section.
// ---------------------------------------------------------------------------

export async function fetchGenerationJob(projectId: string): Promise<DocumentationGenerationJob | null> {
  const { data, error } = await supabase
    .from("documentation_generation_jobs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DocumentationGenerationJob) ?? null;
}

/** Starts (or restarts) a batch run — replaces the job row wholesale. Call
 *  this once at the start of startOrResumeBatch, not per-section. */
export async function upsertGenerationJob(job: {
  projectId: string;
  status: "running" | "completed";
  sectionKeys: DocSectionKey[];
  sectionStatus: SectionStatusMap;
  fingerprint: string | null;
}): Promise<DocumentationGenerationJob> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("documentation_generation_jobs")
    .upsert(
      {
        project_id: job.projectId,
        status: job.status,
        section_keys: job.sectionKeys,
        section_status: job.sectionStatus as any,
        fingerprint: job.fingerprint,
        created_by: user?.id ?? null,
      },
      { onConflict: "project_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as DocumentationGenerationJob;
}

/** Patches exactly one section's status within the job row, leaving every
 *  other section's status untouched — this is what makes "retry only the
 *  current section" and "never regenerate completed sections" possible.
 *  Batch runs are strictly sequential (one section in flight at a time), so
 *  the read-merge-write here has no real concurrent-write race in practice. */
export async function updateJobSectionStatus(
  projectId: string,
  sectionKey: DocSectionKey,
  patch: NonNullable<SectionStatusMap[DocSectionKey]>,
): Promise<void> {
  const job = await fetchGenerationJob(projectId);
  if (!job) return;
  const nextStatus: SectionStatusMap = { ...job.section_status, [sectionKey]: patch };
  const { error } = await supabase
    .from("documentation_generation_jobs")
    .update({ section_status: nextStatus as any })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
}

export async function markJobCompleted(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("documentation_generation_jobs")
    .update({ status: "completed" })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
}
