// path: src/services/mcp/mcpConnections.ts
// Plain RLS-gated reads. No secrets are ever selectable here — mcp_connections
// has no plaintext secret column, and Vault is only reachable from edge
// functions running as service_role.
import { supabase } from "@/integrations/supabase/client";
import type { McpConnection, McpLogEntry, McpPermission, McpServerPreset, McpTool } from "@/types/mcp";

export async function fetchServerPresets(): Promise<McpServerPreset[]> {
  const { data, error } = await supabase.from("mcp_servers").select("*").eq("is_active", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpServerPreset[];
}

export async function fetchConnections(workspaceId: string): Promise<McpConnection[]> {
  const { data, error } = await supabase
    .from("mcp_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "disconnected")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpConnection[];
}

export async function fetchTools(connectionId: string): Promise<McpTool[]> {
  const { data, error } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("is_stale", false)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpTool[];
}

export async function fetchAllToolsForWorkspace(connectionIds: string[]): Promise<McpTool[]> {
  if (connectionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("mcp_tools")
    .select("*")
    .in("connection_id", connectionIds)
    .eq("is_stale", false)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpTool[];
}

export async function fetchPermissionsForConnections(connectionIds: string[]): Promise<McpPermission[]> {
  if (connectionIds.length === 0) return [];
  const { data, error } = await supabase.from("mcp_permissions").select("*").in("connection_id", connectionIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpPermission[];
}

export async function updatePermission(connectionId: string, role: "owner" | "editor", canExecute: boolean): Promise<void> {
  const { error } = await supabase
    .from("mcp_permissions")
    .update({ can_execute: canExecute })
    .eq("connection_id", connectionId)
    .eq("role", role);
  if (error) throw new Error(error.message);
}

export async function fetchRecentLogs(workspaceId: string, limit = 20): Promise<McpLogEntry[]> {
  const { data, error } = await supabase
    .from("mcp_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpLogEntry[];
}
