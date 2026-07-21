// path: src/components/settings/GroupsSection.tsx
import { useEffect, useState } from "react";
import type { Workspace, WorkspaceMember } from "@/lib/workspaces";
import { fetchWorkspaceMembers } from "@/services/workspaces";
import {
  type WorkspaceGroup,
  fetchGroups,
  fetchGroupMembers,
  createGroup,
  renameGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
} from "@/services/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { ChevronDown, ChevronRight, Pencil, UserMinus, Users } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

function memberLabel(member: WorkspaceMember | undefined, userId: string, currentUserId?: string): string {
  if (!member) return "Member";
  const isSelf = userId === currentUserId;
  if (!isSelf && member.profile?.is_public === false) return "Member";
  return member.profile?.display_name || member.profile?.username || userId.slice(0, 8);
}

export default function GroupsSection({ workspace, currentUserId }: Props) {
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [groupMemberIds, setGroupMemberIds] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [addSelection, setAddSelection] = useState<Record<string, string>>({});
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);

  const isOwner = workspace.owner_id === currentUserId;

  const refresh = () => {
    setLoading(true);
    Promise.all([fetchGroups(workspace.id), fetchWorkspaceMembers(workspace.id)])
      .then(async ([fetchedGroups, fetchedMembers]) => {
        setGroups(fetchedGroups);
        setMembers(fetchedMembers);
        const entries = await Promise.all(
          fetchedGroups.map(async (g) => [g.id, await fetchGroupMembers(g.id)] as const),
        );
        setGroupMemberIds(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const toggleExpanded = (groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createGroup(workspace.id, name);
      toast({ title: "Group created" });
      setNewGroupName("");
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't create group",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (group: WorkspaceGroup) => {
    setEditingId(group.id);
    setEditingName(group.name);
  };

  const saveRename = async (group: WorkspaceGroup) => {
    const name = editingName.trim();
    if (!name || name === group.name) {
      setEditingId(null);
      return;
    }
    setSavingRenameId(group.id);
    try {
      const updated = await renameGroup(group.id, name);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      toast({ title: "Group renamed" });
    } catch (err) {
      toast({
        title: "Couldn't rename group",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingRenameId(null);
      setEditingId(null);
    }
  };

  const handleDelete = async (group: WorkspaceGroup) => {
    if (confirmDeleteId !== group.id) {
      setConfirmDeleteId(group.id);
      return;
    }
    setDeletingId(group.id);
    try {
      await deleteGroup(group.id);
      toast({ title: "Group deleted" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't delete group",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleRemoveMember = async (group: WorkspaceGroup, userId: string) => {
    const key = `${group.id}:${userId}`;
    setRemovingKey(key);
    try {
      await removeGroupMember(group.id, userId);
      setGroupMemberIds((prev) => ({
        ...prev,
        [group.id]: (prev[group.id] ?? []).filter((id) => id !== userId),
      }));
      toast({ title: "Member removed from group" });
    } catch (err) {
      toast({
        title: "Couldn't remove member",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRemovingKey(null);
    }
  };

  const handleAddMember = async (group: WorkspaceGroup) => {
    const userId = addSelection[group.id];
    if (!userId) return;
    setAddingGroupId(group.id);
    try {
      await addGroupMember(group.id, workspace.id, userId);
      setGroupMemberIds((prev) => ({
        ...prev,
        [group.id]: [...(prev[group.id] ?? []), userId],
      }));
      setAddSelection((prev) => ({ ...prev, [group.id]: "" }));
      toast({ title: "Member added to group" });
    } catch (err) {
      toast({
        title: "Couldn't add member",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setAddingGroupId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Groups</h3>
        <p className="text-xs text-gray-500 mb-4">Organize members into groups with shared permissions.</p>

        {isOwner && (
          <div className="flex gap-2 mb-4 pb-4 border-b border-gray-100">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="New group name"
              maxLength={50}
              className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !newGroupName.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 shrink-0"
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        )}

        {!isOwner && (
          <p className="text-xs text-gray-400 mb-4">Only the workspace owner can manage groups.</p>
        )}

        {loading && <p className="text-sm text-gray-400 text-center py-6">Loading groups...</p>}

        {!loading && groups.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No groups yet.{isOwner ? " Create one to organize members." : ""}
          </p>
        )}

        {!loading && groups.length > 0 && (
          <div className="space-y-1">
            {groups.map((group) => {
              const memberIds = groupMemberIds[group.id] ?? [];
              const isExpanded = !!expanded[group.id];
              const nonMembers = members.filter((m) => !memberIds.includes(m.user_id));
              const isEditing = editingId === group.id;
              const isConfirmingDelete = confirmDeleteId === group.id;

              return (
                <div key={group.id} className="border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(group.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editingName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => saveRename(group)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(group);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          disabled={savingRenameId === group.id}
                          maxLength={50}
                          className="h-7 bg-white border-gray-200 text-gray-900 text-sm focus-visible:ring-blue-500/30"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 truncate">{group.name}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <Users className="h-3 w-3" /> {memberIds.length}
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && !isEditing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(group);
                          }}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                          title="Rename group"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(group);
                          }}
                          disabled={deletingId === group.id}
                          className={`text-xs transition-colors ${
                            isConfirmingDelete ? "text-red-600 font-medium" : "text-gray-400 hover:text-red-500"
                          }`}
                        >
                          {deletingId === group.id
                            ? "Deleting..."
                            : isConfirmingDelete
                              ? "Confirm delete?"
                              : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pl-5 pb-3 space-y-1">
                      {memberIds.length === 0 && (
                        <p className="text-xs text-gray-400 py-1.5">No members in this group.</p>
                      )}
                      {memberIds.map((userId) => {
                        const member = members.find((m) => m.user_id === userId);
                        const key = `${group.id}:${userId}`;
                        return (
                          <div key={userId} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-sm text-gray-700 truncate">
                              {memberLabel(member, userId, currentUserId)}
                              {userId === currentUserId ? " (you)" : ""}
                            </span>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(group, userId)}
                                disabled={removingKey === key}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              >
                                <UserMinus className="h-3 w-3" /> Remove
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {isOwner && (
                        <div className="flex gap-2 pt-2">
                          <select
                            value={addSelection[group.id] ?? ""}
                            onChange={(e) =>
                              setAddSelection((prev) => ({ ...prev, [group.id]: e.target.value }))
                            }
                            disabled={nonMembers.length === 0}
                            className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">
                              {nonMembers.length === 0 ? "All members added" : "Select a member..."}
                            </option>
                            {nonMembers.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {memberLabel(m, m.user_id, currentUserId)}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            onClick={() => handleAddMember(group)}
                            disabled={!addSelection[group.id] || addingGroupId === group.id}
                            className="border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
                          >
                            {addingGroupId === group.id ? "Adding..." : "Add"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
