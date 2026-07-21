// path: src/components/settings/DesignSystemsSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import type { DesignTokenSet, DesignTokens } from "@/services/designTokens";
import {
  fetchDesignTokenSets, createDesignTokenSet, updateDesignTokenSet, deleteDesignTokenSet,
} from "@/services/designTokens";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

const EMPTY_TOKENS: DesignTokens = {
  primaryColor: "#2563eb",
  secondaryColor: "#0ea5e9",
  backgroundColor: "#ffffff",
  fontFamily: "",
};

export default function DesignSystemsSection({ workspace, currentUserId }: Props) {
  const { user } = useAuth();
  const [sets, setSets] = useState<DesignTokenSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tokens, setTokens] = useState<DesignTokens>(EMPTY_TOKENS);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOwner = workspace.owner_id === currentUserId;

  const refresh = () => {
    setLoading(true);
    fetchDesignTokenSets(workspace.id)
      .then(setSets)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const resetForm = () => {
    setName("");
    setTokens(EMPTY_TOKENS);
    setEditingId(null);
    setShowForm(false);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (set: DesignTokenSet) => {
    setEditingId(set.id);
    setName(set.name);
    setTokens(set.tokens);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user?.id) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateDesignTokenSet(editingId, name.trim(), tokens);
        setSets((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
        toast({ title: "Design system updated" });
      } else {
        const created = await createDesignTokenSet(workspace.id, user.id, name.trim(), tokens);
        setSets((prev) => [created, ...prev]);
        toast({ title: "Design system created" });
      }
      resetForm();
    } catch (err) {
      toast({
        title: "Couldn't save design system",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (set: DesignTokenSet) => {
    setDeletingId(set.id);
    try {
      await deleteDesignTokenSet(set.id);
      setSets((prev) => prev.filter((s) => s.id !== set.id));
      toast({ title: "Design system deleted" });
    } catch (err) {
      toast({
        title: "Couldn't delete design system",
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
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Design systems</h3>
        <p className="text-xs text-gray-500 mb-4">Reusable design tokens and component libraries.</p>

        {!showForm && (
          <Button
            variant="outline"
            onClick={startCreate}
            className="border-gray-200 text-gray-600 hover:bg-gray-50 mb-4"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New design system
          </Button>
        )}

        {showForm && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="design-system-name" className="text-gray-600">Name</Label>
              <Input
                id="design-system-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing site"
                maxLength={50}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="design-system-primary" className="text-gray-600">Primary color</Label>
                <input
                  id="design-system-primary"
                  type="color"
                  value={tokens.primaryColor}
                  onChange={(e) => setTokens((t) => ({ ...t, primaryColor: e.target.value }))}
                  className="h-9 w-14 rounded border border-gray-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="design-system-secondary" className="text-gray-600">Secondary color</Label>
                <input
                  id="design-system-secondary"
                  type="color"
                  value={tokens.secondaryColor}
                  onChange={(e) => setTokens((t) => ({ ...t, secondaryColor: e.target.value }))}
                  className="h-9 w-14 rounded border border-gray-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="design-system-background" className="text-gray-600">Background color</Label>
                <input
                  id="design-system-background"
                  type="color"
                  value={tokens.backgroundColor}
                  onChange={(e) => setTokens((t) => ({ ...t, backgroundColor: e.target.value }))}
                  className="h-9 w-14 rounded border border-gray-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="design-system-font" className="text-gray-600">Font family</Label>
              <Input
                id="design-system-font"
                value={tokens.fontFamily}
                onChange={(e) => setTokens((t) => ({ ...t, fontFamily: e.target.value }))}
                placeholder="Inter, sans-serif"
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={saving}
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading design systems...</p>}
          {!loading && sets.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No design systems yet.</p>
          )}
          {!loading && sets.map((set) => {
            const canManage = set.created_by === currentUserId || isOwner;
            return (
              <div key={set.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: set.tokens.primaryColor }} />
                    <div className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: set.tokens.secondaryColor }} />
                    <div className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: set.tokens.backgroundColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{set.name}</p>
                    <p className="text-xs text-gray-500 truncate">{set.tokens.fontFamily || "No font set"}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(set)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(set)}
                      disabled={deletingId === set.id}
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
