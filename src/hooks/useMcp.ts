// path: src/hooks/useMcp.ts
//
// This app's other settings sections (People, Groups, Plans, ...) all use a
// plain useState + useEffect + service-call "refresh()" pattern rather than
// React Query — @tanstack/react-query is installed but unused elsewhere in
// the app, so these hooks match the established convention instead of
// introducing a second data-fetching paradigm. Mutations (connect,
// disconnect, execute, ...) are called directly from components via
// src/services/mcp/mcpManager.ts, same as every other settings section.
import { useCallback, useEffect, useState } from "react";
import type { McpConnection, McpServerPreset, McpTool } from "@/types/mcp";
import {
  fetchAllToolsForWorkspace, fetchConnections, fetchPermissionsForConnections, fetchServerPresets,
} from "@/services/mcp/mcpConnections";

export function useMcpConnections(workspaceId: string | undefined) {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [presets, setPresets] = useState<McpServerPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([fetchConnections(workspaceId), fetchServerPresets()])
      .then(([conns, presetList]) => {
        setConnections(conns);
        setPresets(presetList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { connections, presets, loading, refresh };
}

export function useMcpTools(connections: McpConnection[]) {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(false);

  const connectedIds = connections.filter((c) => c.status === "connected").map((c) => c.id).join(",");

  const refresh = useCallback(() => {
    const ids = connectedIds ? connectedIds.split(",") : [];
    if (ids.length === 0) {
      setTools([]);
      return;
    }
    setLoading(true);
    fetchAllToolsForWorkspace(ids)
      .then(setTools)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connectedIds]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tools, loading, refresh };
}

/** Editor can_execute flag per connection_id, for a whole workspace's connection list. */
export function useMcpEditorAccess(connections: McpConnection[]) {
  const [editorAccess, setEditorAccess] = useState<Record<string, boolean>>({});
  const ids = connections.map((c) => c.id).join(",");

  const refresh = useCallback(() => {
    const connectionIds = ids ? ids.split(",") : [];
    if (connectionIds.length === 0) {
      setEditorAccess({});
      return;
    }
    fetchPermissionsForConnections(connectionIds)
      .then((perms) => {
        const map: Record<string, boolean> = {};
        for (const p of perms) {
          if (p.role === "editor") map[p.connection_id] = p.can_execute;
        }
        setEditorAccess(map);
      })
      .catch(() => {});
  }, [ids]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { editorAccess, refresh };
}
