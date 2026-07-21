// path: src/components/settings/KnowledgeSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import type { WorkspaceKnowledge } from "@/services/knowledge";
import { fetchKnowledge, addKnowledge, updateKnowledge, deleteKnowledge } from "@/services/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

function truncate(text: string, max = 120) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export default function KnowledgeSection({ workspace, currentUserId }: Props) {
  const [entries, setEntries] = useState<WorkspaceKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOwner = workspace.owner_id === currentUserId;

  const refresh = () => {
    setLoading(true);
    fetchKnowledge(workspace.id)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const handleAdd = async () => {
    if (!currentUserId || !newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await addKnowledge(workspace.id, currentUserId, newTitle.trim(), newContent.trim());
      toast({ title: "Knowledge added" });
      setNewTitle("");
      setNewContent("");
      setAdding(false);
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't add knowledge",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: WorkspaceKnowledge) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      await updateKnowledge(id, editTitle.trim(), editContent.trim());
      toast({ title: "Knowledge updated" });
      cancelEdit();
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't update knowledge",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteKnowledge(id);
      toast({ title: "Knowledge deleted" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't delete knowledge",
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
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Knowledge</h3>
        <p className="text-xs text-gray-500 mb-4">Give the AI extra context about your product and codebase.</p>

        {!adding && (
          <Button
            variant="outline"
            onClick={() => setAdding(true)}
            className="border-gray-200 text-gray-600 hover:bg-gray-50 mb-4"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add knowledge
          </Button>
        )}

        {adding && (
          <div className="space-y-3 mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-knowledge-title" className="text-gray-600">Title</Label>
              <Input
                id="new-knowledge-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. API conventions"
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-knowledge-content" className="text-gray-600">Content</Label>
              <Textarea
                id="new-knowledge-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Add details the AI should know when generating apps for this workspace."
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={saving || !newTitle.trim() || !newContent.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewContent("");
                }}
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading knowledge...</p>}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No knowledge added yet.</p>
          )}
          {!loading && entries.map((entry) => {
            const canEdit = entry.created_by === currentUserId || isOwner;
            const isEditing = editingId === entry.id;

            if (isEditing) {
              return (
                <div key={entry.id} className="space-y-3 py-2.5 border-b border-gray-100 last:border-b-0">
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-knowledge-title-${entry.id}`} className="text-gray-600">Title</Label>
                    <Input
                      id={`edit-knowledge-title-${entry.id}`}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-knowledge-content-${entry.id}`} className="text-gray-600">Content</Label>
                    <Textarea
                      id={`edit-knowledge-content-${entry.id}`}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(entry.id)}
                      disabled={savingEdit || !editTitle.trim() || !editContent.trim()}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={entry.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{entry.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{truncate(entry.content)}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
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
