// path: src/services/workspaceDomains.ts
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceDomain {
  id: string;
  domain: string;
  status: string;
  error_message: string | null;
  created_at: string;
  project: { id: string; title: string };
}

/** Aggregated, read-only view of every custom domain across all projects in a workspace. RLS already restricts rows to the caller's workspace membership. */
export async function fetchWorkspaceDomains(workspaceId: string): Promise<WorkspaceDomain[]> {
  const { data, error } = (await (supabase
    .from("project_domains")
    .select("id, domain, status, error_message, created_at, project:projects!inner(id, title, workspace_id)") as any)
    .eq("project.workspace_id", workspaceId)
    .order("created_at", { ascending: false })) as any;

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkspaceDomain[];
}
