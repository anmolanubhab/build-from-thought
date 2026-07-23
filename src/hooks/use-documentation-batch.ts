// path: src/hooks/use-documentation-batch.ts
//
// React state wrapper around services/documentationBatch.ts for the
// GenerateAllDialog UI: tracks live per-section status, exposes whether an
// interrupted run can be Resumed (persisted job row found on mount), and
// wraps run()/retry() so the dialog never has to touch the service layer
// directly.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocSectionKey, DocumentationSection, SectionStatusMap } from "@/lib/documentation/types";
import { CORE_DOC_SECTION_KEYS } from "@/lib/documentation/registry";
import { fetchGenerationJob } from "@/services/documentation";
import { startOrResumeBatch, retrySingleSection, type BatchProgressEvent } from "@/services/documentationBatch";

export interface UseDocumentationBatchParams {
  projectId: string;
  fingerprint: string;
  /** Current sections keyed by section_key — read for missing/outdated
   *  detection and mutated as the batch completes sections. */
  sectionsByKey: Map<DocSectionKey, DocumentationSection>;
  /** Called every time a section finishes generating, so the caller (the
   *  workspace) can update its own section list/sidebar dots live. */
  onSectionChange: (section: DocumentationSection) => void;
}

export function useDocumentationBatch({ projectId, fingerprint, sectionsByKey, onSectionChange }: UseDocumentationBatchParams) {
  const [sectionStatus, setSectionStatus] = useState<SectionStatusMap>({});
  const [running, setRunning] = useState(false);
  const [hasResumableJob, setHasResumableJob] = useState(false);
  const runningRef = useRef(false);

  // On mount (or project switch), check for a job an earlier run left
  // unfinished — e.g. the tab was closed mid-batch — so Resume is offered
  // instead of either silently restarting or silently doing nothing.
  useEffect(() => {
    let cancelled = false;
    setSectionStatus({});
    setHasResumableJob(false);
    fetchGenerationJob(projectId)
      .then((job) => {
        if (cancelled || !job) return;
        setSectionStatus(job.section_status);
        const hasUnfinished = job.section_keys.some((k) => job.section_status[k]?.status !== "completed");
        setHasResumableJob(job.status === "running" && hasUnfinished);
      })
      .catch(() => { /* best-effort — a missing/unreadable job just means "nothing to resume" */ });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleProgress = useCallback((event: BatchProgressEvent) => {
    setSectionStatus((prev) => ({
      ...prev,
      [event.sectionKey]: {
        status: event.status,
        attempts: prev[event.sectionKey]?.attempts ?? 0,
        error: event.status === "failed" ? event.error : undefined,
        completed_at: event.status === "completed" ? new Date().toISOString() : prev[event.sectionKey]?.completed_at,
      },
    }));
    if (event.section) onSectionChange(event.section);
  }, [onSectionChange]);

  const run = useCallback(async (opts: { force?: boolean } = {}) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setHasResumableJob(false);
    try {
      await startOrResumeBatch({ projectId, fingerprint, sectionsByKey, force: opts.force, onProgress: handleProgress });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [projectId, fingerprint, sectionsByKey, handleProgress]);

  const retry = useCallback(async (sectionKey: DocSectionKey) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      await retrySingleSection(projectId, fingerprint, sectionKey, sectionsByKey, handleProgress);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [projectId, fingerprint, sectionsByKey, handleProgress]);

  const targetKeys = CORE_DOC_SECTION_KEYS;
  const completedCount = targetKeys.filter((k) => sectionStatus[k]?.status === "completed").length;
  const failedKeys = targetKeys.filter((k) => sectionStatus[k]?.status === "failed");

  return { sectionStatus, running, hasResumableJob, targetKeys, completedCount, failedKeys, run, retry };
}
