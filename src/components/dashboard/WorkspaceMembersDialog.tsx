// path: src/components/dashboard/WorkspaceMembersDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { fetchWorkspaceMembers, removeWorkspaceMember } from "@/services/workspaces";
import type { Workspace, WorkspaceMember } from "@/lib/workspaces";
import { Copy, Crown, UserMinus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  currentUserId?: string;
}

export default function WorkspaceMembersDialog({ open, onClose, workspace, currentUserId }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = () => {
    if (!workspace) return;
    setLoading(true);
    fetchWorkspaceMembers(workspace.id)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace?.id]);

  if (!workspace) return null;

  const isOwner = workspace.owner_id === currentUserId;
  const inviteLink = `${window.location.origin}/join/${workspace.invite_code}`;

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
      toast({ title: member.user_id === currentUserId ? "Left workspace" : "Member removed" });
      if (member.user_id === currentUserId) {
        onClose();
      } else {
        refresh();
      }
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--wb-surface)] border-[var(--wb-line)] sm:max-w-md wb-sans">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--wb-text)" }}>{workspace.name}</DialogTitle>
          <DialogDescription style={{ color: "var(--wb-text-muted)" }}>
            Anyone with this link can join as a member.
          </DialogDescription>
        </DialogHeader>

        <button
          onClick={copyInvite}
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:brightness-125"
          style={{ borderColor: "var(--wb-line)", background: "var(--wb-surface-raised)" }}
        >
          <span className="wb-mono text-xs truncate" style={{ color: "var(--wb-text-muted)" }}>{inviteLink}</span>
          <Copy className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--wb-text-muted)" }} />
        </button>

        <div className="space-y-1 max-h-64 overflow-auto -mx-1 px-1">
          {loading && (
            <p className="text-xs text-center py-4" style={{ color: "var(--wb-text-muted)" }}>Loading members...</p>
          )}
          {!loading && members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const label = m.profile?.display_name || m.profile?.username || (isSelf ? "You" : "Member");
            const canRemove = isSelf ? m.role !== "owner" : isOwner && m.role !== "owner";
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  {m.role === "owner" && <Crown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--wb-ember)" }} />}
                  <span className="text-sm truncate" style={{ color: "var(--wb-text)" }}>
                    {label}{isSelf && m.role !== "owner" ? " (you)" : ""}
                  </span>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="flex items-center gap-1 text-xs flex-shrink-0 transition-colors hover:text-red-400"
                    style={{ color: "var(--wb-text-muted)" }}
                  >
                    <UserMinus className="h-3 w-3" /> {isSelf ? "Leave" : "Remove"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
