// path: src/components/settings/TemplatesSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import {
  fetchTemplates,
  fetchWorkspaceProjectsForTemplates,
  saveProjectAsTemplate,
  deleteTemplate,
  type WorkspaceTemplate,
  type TemplateSourceProject,
} from "@/services/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

export default function TemplatesSection({ workspace, currentUserId }: Props) {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [projects, setProjects] = useState<TemplateSourceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOwner = workspace.owner_id === currentUserId;

  const [showForm, setShowForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.all([fetchTemplates(workspace.id), fetchWorkspaceProjectsForTemplates(workspace.id)])
      .then(([t, p]) => {
        setTemplates(t);
        setProjects(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const resetForm = () => {
    setSelectedProjectId("");
    setName("");
    setDescription("");
  };

  const handleSave = async () => {
    if (!currentUserId || !selectedProjectId || !name.trim()) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setSaving(true);
    try {
      await saveProjectAsTemplate(workspace.id, currentUserId, name.trim(), description.trim(), {
        prompt: project.prompt,
        html: project.html,
        css: project.css,
        react_code: project.react_code,
        pages: project.pages,
      });
      toast({ title: "Template saved" });
      resetForm();
      setShowForm(false);
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't save template",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: WorkspaceTemplate) => {
    setDeletingId(template.id);
    try {
      await deleteTemplate(template.id);
      toast({ title: "Template deleted" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't delete template",
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
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Templates</h3>
        <p className="text-xs text-gray-500 mb-4">Save your own starting points for new projects.</p>

        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Save a project as template
          </button>
        )}

        {showForm && (
          <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-project" className="text-gray-600">Project</Label>
              {projects.length === 0 ? (
                <p className="text-xs text-gray-500">No projects to save as a template yet</p>
              ) : (
                <select
                  id="template-project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-name" className="text-gray-600">Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SaaS landing page"
                maxLength={60}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-description" className="text-gray-600">Description (optional)</Label>
              <Input
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
                maxLength={200}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !selectedProjectId || !name.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Saved templates</h3>
        <div className="space-y-1">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading templates...</p>}
          {!loading && templates.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No templates saved yet.</p>
          )}
          {!loading && templates.map((template) => {
            const canDelete = template.created_by === currentUserId || isOwner;
            return (
              <div key={template.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-gray-500 truncate">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(template)}
                    disabled={deletingId === template.id}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
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
