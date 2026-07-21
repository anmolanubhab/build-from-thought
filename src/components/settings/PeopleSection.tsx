// path: src/components/settings/PeopleSection.tsx
import { useEffect, useState } from "react";
import type { Workspace, WorkspaceMember } from "@/lib/workspaces";
import { fetchWorkspaceMembers, removeWorkspaceMember } from "@/services/workspaces";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Copy, Crown, UserMinus } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

export default function PeopleSection({ workspace, currentUserId }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isOwner = workspace.owner_id === currentUserId;
  const inviteLink = `${window.location.origin}/join/${workspace.invite_code}`;

  const refresh = () => {
    setLoading(true);
    fetchWorkspaceMembers(workspace.id)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Couldn't copy link", description: inviteLink, variant: "destructive" });
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    setRemovingId(member.id);
    try {
      await removeWorkspaceMember(member.workspace_id, member.user_id);
      toast({ title: "Member removed" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't remove member",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Invite link</h3>
        <p className="text-xs text-gray-500 mb-3">Anyone with this link can join "{workspace.name}" as a member.</p>
        <button
          onClick={copyInvite}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left transition-colors hover:bg-gray-100"
        >
          <span className="font-mono text-xs text-gray-600 truncate">{inviteLink}</span>
          <Copy className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </button>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Members</h3>
        <div className="space-y-1">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading members...</p>}
          {!loading && members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const profileIsPublic = m.profile?.is_public !== false;
            const label = isSelf
              ? (m.profile?.display_name || m.profile?.username || "You")
              : profileIsPublic
                ? (m.profile?.display_name || m.profile?.username || "Member")
                : "Member";
            const canRemove = isOwner && m.role !== "owner";
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                  <span className="text-sm text-gray-900 truncate">
                    {label}{isSelf ? " (you)" : ""}
                  </span>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <UserMinus className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
