// path: src/services/auditLog.ts
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorLabel: string;
  action: string;
  details: unknown;
  createdAt: string;
}

export async function fetchAuditLog(workspaceId: string, limit = 50): Promise<AuditLogEntry[]> {
  const { data: rows, error } = await supabase
    .from("workspace_audit_log")
    .select("id, actor_id, action, details, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const entries = (rows ?? []) as unknown as {
    id: string;
    actor_id: string | null;
    action: string;
    details: unknown;
    created_at: string;
  }[];

  const actorIds = [...new Set(entries.map((e) => e.actor_id).filter((id): id is string => !!id))];

  let profileMap = new Map<string, { display_name: string | null; username: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", actorIds);

    profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  }

  return entries.map((e) => {
    const profile = e.actor_id ? profileMap.get(e.actor_id) : null;
    const actorLabel = profile?.display_name || profile?.username || "Someone";
    return {
      id: e.id,
      actorId: e.actor_id,
      actorLabel,
      action: e.action,
      details: e.details,
      createdAt: e.created_at,
    };
  });
}
