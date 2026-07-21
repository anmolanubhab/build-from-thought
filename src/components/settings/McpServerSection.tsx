// path: src/components/settings/McpServerSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import { type McpServer, fetchMcpServers, addMcpServer, deleteMcpServer, testMcpServerConnection } from "@/services/mcpServers";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Server, CheckCircle2, XCircle, Loader2, Trash2, Plus } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

interface TestState {
  status: "idle" | "pending" | "done";
  ok?: boolean;
  message?: string;
}

export default function McpServerSection({ workspace, currentUserId }: Props) {
  const { user } = useAuth();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const isOwner = workspace.owner_id === currentUserId;

  const refresh = () => {
    setLoading(true);
    fetchMcpServers(workspace.id)
      .then(setServers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const handleAdd = async () => {
    if (!user?.id || !newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    try {
      await addMcpServer(workspace.id, user.id, newName.trim(), newUrl.trim());
      toast({ title: "MCP server added" });
      setNewName("");
      setNewUrl("");
      setShowAddForm(false);
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't add server",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (server: McpServer) => {
    setDeletingId(server.id);
    try {
      await deleteMcpServer(server.id);
      toast({ title: "MCP server removed" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't remove server",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (server: McpServer) => {
    setTestStates((prev) => ({ ...prev, [server.id]: { status: "pending" } }));
    const result = await testMcpServerConnection(server.url);
    setTestStates((prev) => ({ ...prev, [server.id]: { status: "done", ok: result.ok, message: result.message } }));
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900">MCP server</h3>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add server
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Connect external tools to WebdevsAI via the Model Context Protocol.</p>

        {showAddForm && (
          <div className="space-y-3 mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="space-y-1.5">
              <Label htmlFor="mcp-server-name" className="text-gray-600">Name</Label>
              <Input
                id="mcp-server-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My MCP server"
                maxLength={100}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcp-server-url" className="text-gray-600">URL</Label>
              <Input
                id="mcp-server-url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/mcp"
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30 font-mono text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newUrl.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {adding ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={() => setShowAddForm(false)}
                disabled={adding}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading servers...</p>}
          {!loading && servers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No MCP servers connected yet.</p>
          )}
          {!loading && servers.map((server) => {
            const canDelete = server.created_by === currentUserId || isOwner;
            const test = testStates[server.id];
            return (
              <div key={server.id} className="py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Server className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{server.name}</p>
                      <p className="font-mono text-xs text-gray-500 truncate">{server.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => handleTest(server)}
                      disabled={test?.status === "pending"}
                    >
                      {test?.status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
                    </Button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(server)}
                        disabled={deletingId === server.id}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
                {test?.status === "done" && (
                  <div className={`flex items-center gap-1 mt-1.5 text-xs ${test.ok ? "text-green-600" : "text-red-500"}`}>
                    {test.ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                    <span>{test.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
