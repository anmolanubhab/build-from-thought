// path: src/components/settings/WorkspaceSection.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/lib/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import { updateWorkspaceName, removeWorkspaceMember } from "@/services/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Copy, Sparkles } from "lucide-react";

interface Props {
  workspace: Workspace;
  workspaceCount: number;
  currentUserId?: string;
  onWorkspaceUpdated: (w: Workspace) => void;
}

export default function WorkspaceSection({ workspace, workspaceCount, currentUserId, onWorkspaceUpdated }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isOwner = workspace.owner_id === currentUserId;
  const canLeave = !isOwner && workspaceCount > 1;

  useEffect(() => {
    setName(workspace.name);
  }, [workspace.name, workspace.id]);

  const saveName = async () => {
    if (!name.trim() || name.trim() === workspace.name) return;
    setSaving(true);
    try {
      const updated = await updateWorkspaceName(workspace.id, name.trim());
      onWorkspaceUpdated(updated);
      toast({ title: "Workspace renamed" });
    } catch (err) {
      toast({
        title: "Couldn't rename workspace",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(workspace.id);
    toast({ title: "Workspace ID copied" });
  };

  const handleLeave = async () => {
    if (!currentUserId || !canLeave) return;
    setLeaving(true);
    try {
      await removeWorkspaceMember(workspace.id, currentUserId);
      localStorage.removeItem(CURRENT_WORKSPACE_STORAGE_KEY);
      toast({ title: "Left workspace" });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Couldn't leave workspace",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Workspace profile</h3>
        <p className="text-xs text-gray-500 mb-4">Control how this workspace appears in WebdevsAI.</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-6 py-1">
            <div>
              <p className="text-sm font-medium text-gray-900">Avatar</p>
              <p className="text-xs text-gray-500 mt-0.5">Set an avatar for your workspace.</p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-cyan-400">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <Label htmlFor="workspace-name" className="text-gray-600">Name</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                disabled={!isOwner}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {isOwner && (
                <Button onClick={saveName} disabled={saving || !name.trim() || name.trim() === workspace.name} className="bg-blue-600 text-white hover:bg-blue-700">
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
            {!isOwner && <p className="text-xs text-gray-400">Only the workspace owner can rename it.</p>}
          </div>

          <div className="flex items-center justify-between gap-6 py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Workspace ID</p>
              <p className="text-xs text-gray-500 mt-0.5">Unique workspace identifier</p>
            </div>
            <button onClick={copyId} className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-gray-900 transition-colors">
              {workspace.id.slice(0, 8)}...{workspace.id.slice(-4)} <Copy className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-6 py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Workspace handle</p>
              <p className="text-xs text-gray-500 mt-0.5">Set a handle for the workspace profile page.</p>
            </div>
            <Button
              variant="outline"
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => toast({ title: "Coming soon", description: "Workspace handles aren't available yet." })}
            >
              Set handle
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Member defaults</h3>
        <p className="text-xs text-gray-500 mb-4">Set default limits for workspace members.</p>
        <div className="space-y-1.5">
          <Label className="text-gray-600">Default monthly member credit limit</Label>
          <Input
            disabled
            placeholder="Enter default monthly member credit limit"
            className="bg-gray-50 border-gray-200 text-gray-400"
          />
          <p className="text-xs text-gray-400">Coming soon — every member currently uses their own daily credit limit.</p>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Workspace access</h3>
        <div className="flex items-center justify-between gap-6 pt-2">
          <div>
            <p className="text-sm text-gray-500">
              {canLeave
                ? "You'll lose access to this workspace's projects immediately."
                : isOwner
                  ? "Workspace owners can't leave — transfer ownership or delete the workspace instead."
                  : "You cannot leave your last workspace. Your account must be a member of at least one workspace."}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!canLeave || leaving}
            onClick={handleLeave}
            className="border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 shrink-0"
          >
            {leaving ? "Leaving..." : "Leave workspace"}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard className="border-red-200">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Danger zone</h3>
        <div className="flex items-center justify-between gap-6 pt-2">
          <div>
            <p className="text-sm font-medium text-gray-900">Delete workspace</p>
            <p className="text-xs text-gray-500 mt-0.5">Permanently delete this workspace and all projects in it. Members lose access immediately.</p>
          </div>
          <Button
            variant="outline"
            disabled
            className="border-red-200 text-red-400 shrink-0 cursor-not-allowed"
            title="Coming soon"
          >
            Delete workspace
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
