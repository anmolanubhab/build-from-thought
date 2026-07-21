// path: src/components/settings/SkillsSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import type { WorkspaceSkill } from "@/services/skills";
import { fetchSkills, addSkill, updateSkill, deleteSkill } from "@/services/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export default function SkillsSection({ workspace, currentUserId }: Props) {
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = workspace.owner_id === currentUserId;

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    fetchSkills(workspace.id)
      .then(setSkills)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const resetAddForm = () => {
    setAdding(false);
    setNewName("");
    setNewInstructions("");
  };

  const handleAdd = async () => {
    if (!currentUserId || !newName.trim() || !newInstructions.trim()) return;
    setSaving(true);
    try {
      await addSkill(workspace.id, currentUserId, newName.trim(), newInstructions.trim());
      toast({ title: "Skill added" });
      resetAddForm();
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't add skill",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (skill: WorkspaceSkill) => {
    setEditingId(skill.id);
    setEditName(skill.name);
    setEditInstructions(skill.instructions);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditInstructions("");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !editInstructions.trim()) return;
    setUpdating(true);
    try {
      await updateSkill(id, editName.trim(), editInstructions.trim());
      toast({ title: "Skill updated" });
      cancelEdit();
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't update skill",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSkill(id);
      toast({ title: "Skill deleted" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't delete skill",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Skills</h3>
        <p className="text-xs text-gray-500 mb-4">Reusable AI instructions your workspace can invoke.</p>

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors mb-4"
          >
            <Plus className="h-3.5 w-3.5" /> Add skill
          </button>
        )}

        {adding && (
          <div className="space-y-3 mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-skill-name" className="text-gray-600">Name</Label>
              <Input
                id="new-skill-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Playful tone"
                maxLength={80}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-skill-instructions" className="text-gray-600">Instructions</Label>
              <Textarea
                id="new-skill-instructions"
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Describe what this skill should do..."
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={saving || !newName.trim() || !newInstructions.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={resetAddForm}
                disabled={saving}
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading skills...</p>}
          {!loading && skills.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No skills added yet.</p>
          )}
          {!loading && skills.map((skill) => {
            const canManage = skill.created_by === currentUserId || isOwner;
            const isEditing = editingId === skill.id;

            if (isEditing) {
              return (
                <div key={skill.id} className="space-y-3 py-2.5 border-b border-gray-100 last:border-b-0">
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-skill-name-${skill.id}`} className="text-gray-600">Name</Label>
                    <Input
                      id={`edit-skill-name-${skill.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={80}
                      className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-skill-instructions-${skill.id}`} className="text-gray-600">Instructions</Label>
                    <Textarea
                      id={`edit-skill-instructions-${skill.id}`}
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleUpdate(skill.id)}
                      disabled={updating || !editName.trim() || !editInstructions.trim()}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {updating ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={updating}
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={skill.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{skill.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{truncate(skill.instructions, 120)}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(skill)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      disabled={deletingId === skill.id}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
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
