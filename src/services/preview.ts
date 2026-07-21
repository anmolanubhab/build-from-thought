// path: src/services/preview.ts
// Frontend service layer for the live Next.js preview runtime (Phase 3: Real Preview
// Environment). Deliberately written against a generic "preview session" shape —
// nothing here mentions E2B. The five preview-* edge functions are the ONLY place
// that talks to the sandbox provider; swapping providers later (Vercel Sandbox,
// Daytona, a self-hosted pool, ...) only touches those functions, never this file
// or the components that call it.

import { supabase } from "@/integrations/supabase/client";

export type PreviewStatus =
  | "idle" // no session row yet / not a modern project
  | "starting"
  | "installing"
  | "starting_server"
  | "running"
  | "error"
  | "stopped";

export interface PreviewSession {
  status: PreviewStatus;
  preview_url?: string | null;
  error_message?: string | null;
  log_tail?: string | null;
  port?: number;
}

export interface PreviewStartResult {
  status: PreviewStatus;
  session?: PreviewSession;
  error?: string;
  logs?: string;
}

export interface PreviewSyncResult {
  status: PreviewStatus;
  synced?: number;
  installed?: boolean;
  error?: string;
  logs?: string;
}

/**
 * Boots (or reconnects to) the live preview for a project. Pass the open draft's
 * version id when one exists so the preview runs the version actually being edited
 * instead of the last published snapshot — mirrors how createPreviewDeployment()
 * already threads a version id through to vercel-deploy.
 */
export async function startPreview(projectId: string, versionId?: string | null): Promise<PreviewStartResult> {
  const { data, error } = await supabase.functions.invoke("preview-start", {
    body: { project_id: projectId, version_id: versionId ?? undefined },
  });
  if (error) throw new Error(error.message || "Failed to start the live preview");
  return data as PreviewStartResult;
}

/** Polls an in-flight or running preview session for fresh status/logs. */
export async function getPreviewStatus(projectId: string): Promise<PreviewStartResult> {
  const { data, error } = await supabase.functions.invoke("preview-status", {
    body: { project_id: projectId },
  });
  if (error) throw new Error(error.message || "Failed to check preview status");
  return data as PreviewStartResult;
}

/**
 * Pushes changed files into an already-running sandbox so Fast Refresh picks them
 * up without a restart. No-ops (status "idle") when there's no live sandbox to push
 * into — the caller should fall back to startPreview() in that case.
 */
export async function syncPreview(projectId: string, versionId?: string | null, changedPaths?: string[]): Promise<PreviewSyncResult> {
  const { data, error } = await supabase.functions.invoke("preview-sync", {
    body: { project_id: projectId, version_id: versionId ?? undefined, changed_paths: changedPaths ?? undefined },
  });
  if (error) throw new Error(error.message || "Failed to sync the live preview");
  return data as PreviewSyncResult;
}

/** Explicit "Stop Preview" control — kills the sandbox right away. */
export async function stopPreview(projectId: string): Promise<{ status: PreviewStatus }> {
  const { data, error } = await supabase.functions.invoke("preview-stop", {
    body: { project_id: projectId },
  });
  if (error) throw new Error(error.message || "Failed to stop the live preview");
  return data as { status: PreviewStatus };
}

/** "Restart Preview" / "Rebuild": tear down and provision a fresh sandbox. */
export async function restartPreview(projectId: string, versionId?: string | null): Promise<PreviewStartResult> {
  try {
    await stopPreview(projectId);
  } catch {
    // Best-effort — proceed to start a fresh one regardless.
  }
  return startPreview(projectId, versionId);
}
