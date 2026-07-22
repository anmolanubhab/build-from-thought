// path: src/services/database.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * supabase-js's functions.invoke() collapses ANY non-2xx edge function response into a
 * generic `FunctionsHttpError` whose `.message` is just "Edge Function returned a non-2xx
 * status code" — the actual `{ error, message }` JSON body our functions send back is only
 * reachable via `error.context` (the raw fetch Response). Without this, every real error
 * message from provision-database/check-database-provisioning (e.g. "This project has no
 * database schema...") got swallowed and replaced with that one generic string.
 */
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      const msg = (body as { message?: unknown; error?: unknown } | null)?.message ?? (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // Response body wasn't JSON (or already consumed) — fall through to the generic message.
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

export type DatabaseProvider = "supabase";
export type DatabaseMode = "shared" | "dedicated";
export type DatabaseStatus = "provisioning" | "ready" | "error";

export interface ProjectDatabase {
  mode: DatabaseMode;
  provider: DatabaseProvider;
  project_ref: string | null;
  project_url: string | null;
  /** The anon (publishable) key — safe to ship client-side, protected by RLS on the actual tables. Never the service role key. Only populated by getProjectDatabase(), not by the provision/check responses. */
  anon_key?: string | null;
  table_prefix: string | null;
  tables: string[];
}

export interface ProvisionResult {
  status: DatabaseStatus;
  database: ProjectDatabase;
  /** Only present once status is "ready" — the merged file map to apply into the editor. */
  files?: Record<string, string>;
  changed_paths?: string[];
  data_layer_rewired?: boolean;
  qa?: {
    issues_found: number;
    auto_fixes: string[];
    ai_fixed: number;
    remaining: { file: string; issue: string }[];
  };
}

/** Kicks off database provisioning. "shared" finishes synchronously; "dedicated" returns status "provisioning" — poll checkDatabaseProvisioning(). */
export async function provisionDatabase(projectId: string, mode: DatabaseMode): Promise<ProvisionResult> {
  const { data, error } = await supabase.functions.invoke("provision-database", {
    body: { project_id: projectId, mode },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to start database provisioning"));
  if (data?.error) throw new Error(data.message || data.error);
  return data as ProvisionResult;
}

/** Polls a "dedicated" mode provisioning job. Call every few seconds until status !== "provisioning". */
export async function checkDatabaseProvisioning(projectId: string): Promise<ProvisionResult> {
  const { data, error } = await supabase.functions.invoke("check-database-provisioning", {
    body: { project_id: projectId },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to check provisioning status"));
  if (data?.error) throw new Error(data.message || data.error);
  return data as ProvisionResult;
}

/** Reads the current project_databases row (if any) directly — safe under RLS (workspace members only). */
export async function getProjectDatabase(projectId: string): Promise<(ProjectDatabase & { status: DatabaseStatus; error_message: string | null }) | null> {
  const { data, error } = await supabase
    .from("project_databases")
    .select("mode, provider, project_ref, project_url, anon_key, table_prefix, tables, status, error_message")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as ProjectDatabase & { status: DatabaseStatus; error_message: string | null };
}
