// path: src/services/database.ts
import { supabase } from "@/integrations/supabase/client";

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
  if (error) throw new Error(error.message || "Failed to start database provisioning");
  if (data?.error) throw new Error(data.message || data.error);
  return data as ProvisionResult;
}

/** Polls a "dedicated" mode provisioning job. Call every few seconds until status !== "provisioning". */
export async function checkDatabaseProvisioning(projectId: string): Promise<ProvisionResult> {
  const { data, error } = await supabase.functions.invoke("check-database-provisioning", {
    body: { project_id: projectId },
  });
  if (error) throw new Error(error.message || "Failed to check provisioning status");
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
