// path: src/components/settings/McpIntegrationsSection.tsx
import { useMemo, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import type { McpConnection, McpServerPreset } from "@/types/mcp";
import { useMcpConnections, useMcpEditorAccess, useMcpTools } from "@/hooks/useMcp";
import { disconnectMcp, refreshMcpTools } from "@/services/mcp/mcpManager";
import { updatePermission } from "@/services/mcp/mcpConnections";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import McpConnectionCard from "./McpConnectionCard";
import McpConnectDialog from "./McpConnectDialog";
import McpToolChatPanel from "./McpToolChatPanel";
import { Plus, Search } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

interface DialogState {
  open: boolean;
  preset?: McpServerPreset;
  reconnectConnectionId?: string;
}

export default function McpIntegrationsSection({ workspace, currentUserId }: Props) {
  const { connections, presets, loading, refresh: refreshConnections } = useMcpConnections(workspace.id);
  const { tools, refresh: refreshTools } = useMcpTools(connections);
  const { editorAccess, refresh: refreshEditorAccess } = useMcpEditorAccess(connections);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const isOwner = workspace.owner_id === currentUserId;

  const connectionByServerId = useMemo(() => {
    const map: Record<string, McpConnection> = {};
    for (const c of connections) if (c.server_id) map[c.server_id] = c;
    return map;
  }, [connections]);

  const customConnections = useMemo(() => connections.filter((c) => !c.server_id), [connections]);

  const toolCountFor = (connectionId: string) => tools.filter((t) => t.connection_id === connectionId).length;

  const matchesSearch = (name: string) => !search.trim() || name.toLowerCase().includes(search.trim().toLowerCase());

  const handleRefreshTools = async (connectionId: string) => {
    setBusyId(connectionId);
    try {
      await refreshMcpTools(connectionId);
      toast({ title: "Tools refreshed" });
      refreshConnections();
      refreshTools();
    } catch (err) {
      toast({ title: "Couldn't refresh tools", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    setBusyId(connectionId);
    try {
      await disconnectMcp(connectionId);
      toast({ title: "Disconnected" });
      refreshConnections();
    } catch (err) {
      toast({ title: "Couldn't disconnect", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleEditorAccess = async (connectionId: string, value: boolean) => {
    try {
      await updatePermission(connectionId, "editor", value);
      refreshEditorAccess();
    } catch (err) {
      toast({ title: "Couldn't update permission", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const onConnected = () => {
    refreshConnections();
    refreshTools();
    refreshEditorAccess();
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 -mt-2">
        Connect real MCP servers so the AI can use their tools. Everything runs server-side — API keys are stored encrypted and never reach your browser.
      </p>

      <div className="relative w-full max-w-[260px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input placeholder="Search servers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.filter((p) => matchesSearch(p.name)).map((preset) => {
              const connection = connectionByServerId[preset.id];
              return (
                <McpConnectionCard
                  key={preset.id}
                  title={preset.name}
                  subtitle={preset.description}
                  docUrl={preset.doc_url}
                  connection={connection}
                  toolCount={connection ? toolCountFor(connection.id) : 0}
                  isOwner={isOwner}
                  busy={busyId === connection?.id}
                  editorCanExecute={connection ? editorAccess[connection.id] : undefined}
                  onToggleEditorAccess={connection ? (v) => handleToggleEditorAccess(connection.id, v) : undefined}
                  onConnect={() => setDialog({ open: true, preset })}
                  onReconnect={() => setDialog({ open: true, preset, reconnectConnectionId: connection?.id })}
                  onDisconnect={() => connection && handleDisconnect(connection.id)}
                  onRefreshTools={() => connection && handleRefreshTools(connection.id)}
                />
              );
            })}
          </div>

          {(customConnections.length > 0 || search.trim() === "") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Custom servers</h3>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setDialog({ open: true })} className="gap-1.5 text-xs h-7">
                    <Plus className="h-3.5 w-3.5" /> Add Custom MCP Server
                  </Button>
                )}
              </div>
              {customConnections.filter((c) => matchesSearch(c.name)).length === 0 ? (
                <p className="text-sm text-gray-400">No custom servers connected yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customConnections.filter((c) => matchesSearch(c.name)).map((connection) => (
                    <McpConnectionCard
                      key={connection.id}
                      title={connection.name}
                      subtitle={connection.endpoint_url}
                      connection={connection}
                      toolCount={toolCountFor(connection.id)}
                      isOwner={isOwner}
                      busy={busyId === connection.id}
                      editorCanExecute={editorAccess[connection.id]}
                      onToggleEditorAccess={(v) => handleToggleEditorAccess(connection.id, v)}
                      onConnect={() => {}}
                      onReconnect={() => setDialog({ open: true, reconnectConnectionId: connection.id })}
                      onDisconnect={() => handleDisconnect(connection.id)}
                      onRefreshTools={() => handleRefreshTools(connection.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <McpToolChatPanel workspaceId={workspace.id} tools={tools} />

      <McpConnectDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        workspaceId={workspace.id}
        preset={dialog.preset}
        reconnectConnectionId={dialog.reconnectConnectionId}
        onConnected={onConnected}
      />
    </div>
  );
}
