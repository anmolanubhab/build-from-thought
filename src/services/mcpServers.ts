// path: src/services/mcpServers.ts
import { supabase } from "@/integrations/supabase/client";

export interface McpServer {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  created_by: string;
  created_at: string;
}

export async function fetchMcpServers(workspaceId: string): Promise<McpServer[]> {
  const { data, error } = await supabase
    .from("workspace_mcp_servers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as McpServer[];
}

/** RLS allows any workspace member to insert (created_by = own id). */
export async function addMcpServer(workspaceId: string, userId: string, name: string, url: string): Promise<McpServer> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    throw new Error("Server URL must start with http:// or https://");
  }

  const { data, error } = await supabase
    .from("workspace_mcp_servers")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: name.trim(),
      url: trimmedUrl,
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as McpServer;
}

/** RLS restricts this to the row's creator or the workspace owner. */
export async function deleteMcpServer(id: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_mcp_servers")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Performs a real reachability check against the given URL. Any resolved
 * fetch (including a CORS-opaque response) means the host is reachable;
 * a thrown error means a network-level failure or timeout.
 */
export async function testMcpServerConnection(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
    if (res.status === 0) {
      return { ok: true, message: "Reachable (server responded, response opaque due to CORS)" };
    }
    return { ok: true, message: `Reachable (HTTP ${res.status})` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unreachable" };
  }
}
