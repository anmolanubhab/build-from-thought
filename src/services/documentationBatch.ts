// path: src/services/documentationBatch.ts
//
// Generate All orchestrator: sequential, persisted, resumable.
//
// This NEVER batches multiple sections into one AI request — every section
// still goes through its own generateSection() call (one edge-function
// invocation, one Gemini call), exactly like the single-section Generate
// button. What this module adds on top:
//   1. The target section list, computed once per run (missing/outdated
//      core sections, or all of them with `force`).
//   2. Strict sequencing — one section in flight at a time.
//   3. Persistence: documentation_generation_jobs is updated after every
//      single attempt (success or exhausted-retry failure), so a closed tab
//      mid-batch can Resume instead of losing progress or restarting from
//      zero.
//   4. Retry-with-backoff per section (via services/documentation.ts's
//      withRetry) for transient failures — 429/500/502/503/504/network.
//   5. "Keep going" — a section that fails after retries is marked failed
//      and the batch moves on to the next one; it never aborts the run.

import type {
  DocSectionKey, DocumentationSection, GenerationMode, SectionStatusMap,
} from "@/lib/documentation/types";
import { CORE_DOC_SECTION_KEYS } from "@/lib/documentation/registry";
import {
  generateSection, withRetry, fetchGenerationJob, upsertGenerationJob,
  updateJobSectionStatus, markJobCompleted, isSectionOutdated,
} from "@/services/documentation";

export interface BatchProgressEvent {
  sectionKey: DocSectionKey;
  status: "running" | "completed" | "failed";
  section?: DocumentationSection;
  error?: string;
}

export interface StartBatchParams {
  projectId: string;
  fingerprint: string;
  /** Current sections keyed by section_key — used to decide what's
   *  missing/outdated and whether a regenerate should go through merge mode.
   *  Mutated in place as sections complete, so the caller's map stays current. */
  sectionsByKey: Map<DocSectionKey, DocumentationSection>;
  /** Regenerate every core section regardless of current state. */
  force?: boolean;
  onProgress?: (event: BatchProgressEvent) => void;
}

/** Exported for unit testing — pure function, no I/O. */
export function computeTargetSections(params: StartBatchParams): DocSectionKey[] {
  if (params.force) return [...CORE_DOC_SECTION_KEYS];
  return CORE_DOC_SECTION_KEYS.filter((key) => {
    const existing = params.sectionsByKey.get(key);
    return !existing || !existing.content_md?.trim() || isSectionOutdated(existing, params.fingerprint);
  });
}

async function runSection(
  projectId: string,
  fingerprint: string,
  key: DocSectionKey,
  sectionsByKey: Map<DocSectionKey, DocumentationSection>,
  onProgress?: (e: BatchProgressEvent) => void,
): Promise<void> {
  onProgress?.({ sectionKey: key, status: "running" });
  await updateJobSectionStatus(projectId, key, { status: "running", attempts: 0 });

  const existing = sectionsByKey.get(key);
  const mode: GenerationMode = existing?.has_manual_edits ? "merge" : existing?.content_md?.trim() ? "regenerate" : "generate";

  let attempts = 0;
  try {
    const section = await withRetry(() => {
      attempts += 1;
      return generateSection({
        projectId, sectionKey: key, mode, fingerprint,
        existingMarkdown: existing?.content_md,
      });
    });
    sectionsByKey.set(key, section);
    await updateJobSectionStatus(projectId, key, { status: "completed", attempts, completed_at: new Date().toISOString() });
    onProgress?.({ sectionKey: key, status: "completed", section });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await updateJobSectionStatus(projectId, key, { status: "failed", attempts, error: message });
    onProgress?.({ sectionKey: key, status: "failed", error: message });
    // Deliberately not re-thrown — the batch continues to the next section.
  }
}

/** Starts a fresh batch, or resumes an interrupted one — always safe to call
 *  repeatedly: any section already marked 'completed' in a prior run against
 *  this same target list is skipped, never regenerated, unless `force`. */
export async function startOrResumeBatch(params: StartBatchParams): Promise<void> {
  const targetKeys = computeTargetSections(params);
  const existingJob = await fetchGenerationJob(params.projectId);

  const seedStatus: SectionStatusMap = {};
  for (const key of targetKeys) {
    const prior = existingJob?.section_status?.[key];
    seedStatus[key] = (!params.force && prior?.status === "completed")
      ? prior
      : { status: "pending", attempts: 0 };
  }

  await upsertGenerationJob({
    projectId: params.projectId,
    status: "running",
    sectionKeys: targetKeys,
    sectionStatus: seedStatus,
    fingerprint: params.fingerprint,
  });

  for (const key of targetKeys) {
    if (seedStatus[key]?.status === "completed") {
      params.onProgress?.({ sectionKey: key, status: "completed", section: params.sectionsByKey.get(key) });
      continue;
    }
    await runSection(params.projectId, params.fingerprint, key, params.sectionsByKey, params.onProgress);
  }

  await markJobCompleted(params.projectId);
}

/** Retries exactly one section (the per-section Retry button in the Generate
 *  All progress UI) — never touches any other section's status, and never
 *  re-runs the rest of the batch. */
export async function retrySingleSection(
  projectId: string,
  fingerprint: string,
  sectionKey: DocSectionKey,
  sectionsByKey: Map<DocSectionKey, DocumentationSection>,
  onProgress?: (e: BatchProgressEvent) => void,
): Promise<void> {
  await runSection(projectId, fingerprint, sectionKey, sectionsByKey, onProgress);
  // A retry can flip an overall-'completed' job back to having a freshly
  // completed section — re-mark the job completed so `status` stays accurate
  // (it's a single-section op, so there's never a "some sections still
  // pending" state to worry about here).
  await markJobCompleted(projectId);
}
