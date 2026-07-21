// path: src/components/settings/WorkspaceSection.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/lib/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import {
  updateWorkspaceName, removeWorkspaceMember, uploadWorkspaceAvatar,
  updateWorkspaceHandle, updateWorkspaceMemberDefaults,
} from "@/services/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Copy, Loader2, Sparkles } from "lucide-react";

interface Props {
  workspace: Workspace;
  workspaceCount: number;
  currentUserId?: string;
  onWorkspaceUpdated: (w: Workspace) => void;
}

export default function WorkspaceSection({ workspace, workspaceCount, currentUserId, onWorkspaceUpdated }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(workspace.name);
  const [handle, setHandle] = useState(workspace.handle || "");
  const [memberLimit, setMemberLimit] = useState(workspace.default_member_credit_limit?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [savingHandle, setSavingHandle] = useState(false);
  const [savingLimit, setSavingLimit] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isOwner = workspace.owner_id === currentUserId;
  const canLeave = !isOwner && workspaceCount > 1;

  useEffect(() => {
    setName(workspace.name);
    setHandle(workspace.handle || "");
    setMemberLimit(workspace.default_member_credit_limit?.toString() || "");
  }, [workspace.id, workspace.name, workspace.handle, workspace.default_member_credit_limit]);

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

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isOwner) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadWorkspaceAvatar(workspace.id, file);
      onWorkspaceUpdated(updated);
      toast({ title: "Avatar updated" });
    } catch (err) {
      toast({
        title: "Couldn't upload avatar",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(workspace.id);
    toast({ title: "Workspace ID copied" });
  };

  const saveHandle = async () => {
    if (!handle.trim() || handle.trim() === workspace.handle) return;
    setSavingHandle(true);
    try {
      const updated = await updateWorkspaceHandle(workspace.id, handle.trim());
      onWorkspaceUpdated(updated);
      setHandle(updated.handle || "");
      toast({ title: "Handle updated" });
    } catch (err) {
      toast({
        title: "Couldn't set handle",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingHandle(false);
    }
  };

  const saveMemberLimit = async () => {
    const trimmed = memberLimit.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
      toast({ title: "Enter a positive whole number, or leave it blank.", variant: "destructive" });
      return;
    }
    setSavingLimit(true);
    try {
      const updated = await updateWorkspaceMemberDefaults(workspace.id, parsed);
      onWorkspaceUpdated(updated);
      toast({ title: "Member defaults saved" });
    } catch (err) {
      toast({
        title: "Couldn't save member defaults",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingLimit(false);
    }
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
              <p className="text-xs text-gray-500 mt-0.5">
                {isOwner ? "Click to upload an image (max 2MB)." : "Set an avatar for your workspace."}
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              type="button"
              onClick={isOwner ? handleAvatarPick : undefined}
              disabled={!isOwner || uploadingAvatar}
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-cyan-400 bg-cover bg-center overflow-hidden disabled:cursor-default"
              style={workspace.avatar_url ? { backgroundImage: `url(${workspace.avatar_url})` } : undefined}
              title={isOwner ? "Change avatar" : undefined}
            >
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : !workspace.avatar_url ? (
                <Sparkles className="h-5 w-5 text-white" />
              ) : null}
            </button>
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

          <div className="space-y-1.5 pt-3 border-t border-gray-100">
            <Label htmlFor="workspace-handle" className="text-gray-600">Workspace handle</Label>
            <p className="text-xs text-gray-500 mb-1">Reserved for a future public workspace page — lowercase letters, numbers, and hyphens.</p>
            <div className="flex gap-2">
              <Input
                id="workspace-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="my-workspace"
                maxLength={50}
                disabled={!isOwner}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {isOwner && (
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-600 hover:bg-gray-50"
                  onClick={saveHandle}
                  disabled={savingHandle || !handle.trim() || handle.trim() === workspace.handle}
                >
                  {savingHandle ? "Saving..." : "Set handle"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Member defaults</h3>
        <p className="text-xs text-gray-500 mb-4">Set default limits for workspace members.</p>
        <div className="space-y-1.5">
          <Label htmlFor="member-credit-limit" className="text-gray-600">Default daily member credit limit</Label>
          <div className="flex gap-2">
            <Input
              id="member-credit-limit"
              type="number"
              min={1}
              step={1}
              value={memberLimit}
              onChange={(e) => setMemberLimit(e.target.value)}
              disabled={!isOwner}
              placeholder="Enter default daily credit limit"
              className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {isOwner && (
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={saveMemberLimit}
                disabled={savingLimit || memberLimit.trim() === (workspace.default_member_credit_limit?.toString() || "")}
              >
                {savingLimit ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Applies to members who join from now on — leaving this blank keeps the standard daily limit. Doesn't change existing members retroactively.
          </p>
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
