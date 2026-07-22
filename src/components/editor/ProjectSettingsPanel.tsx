// path: src/components/editor/ProjectSettingsPanel.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SettingsCard, { SettingsRow } from "@/components/settings/SettingsCard";
import type { Project } from "@/lib/projects";
import { updateProject, deleteProject, toggleStar } from "@/services/db";
import { toast } from "@/hooks/use-toast";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

export default function ProjectSettingsPanel({ project, onUpdate }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(project.title);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveTitle = async () => {
    if (title.trim() === project.title || !title.trim()) { setTitle(project.title); return; }
    setSaving(true);
    try {
      const updated = await updateProject(project.id, { title: title.trim() });
      onUpdate(updated);
      toast({ title: "Project renamed" });
    } catch (err) {
      toast({ title: "Rename failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setTitle(project.title);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStar = async () => {
    try {
      const updated = await toggleStar(project.id, !project.is_starred);
      onUpdate(updated);
    } catch (err) {
      toast({ title: "Couldn't update", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

        <SettingsCard>
          <SettingsRow label="Project name" description="Shown across the dashboard and in exported documentation.">
            <div className="flex items-center gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} className="h-8 w-56 text-sm" />
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
          </SettingsRow>
          <SettingsRow label="Starred" description="Pin this project to the top of your dashboard.">
            <Button size="sm" variant={project.is_starred ? "default" : "outline"} className="gap-1.5 text-xs" onClick={handleToggleStar}>
              <Star className={`h-3.5 w-3.5 ${project.is_starred ? "fill-current" : ""}`} /> {project.is_starred ? "Starred" : "Star"}
            </Button>
          </SettingsRow>
          <SettingsRow label="Public" description="Anyone with the share link can view a read-only preview.">
            <Switch checked={project.is_public} onCheckedChange={async (checked) => {
              try {
                const updated = await updateProject(project.id, { is_public: checked });
                onUpdate(updated);
              } catch (err) {
                toast({ title: "Couldn't update", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
              }
            }} />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard>
          <SettingsRow label="Slug" description="Used in the project's share URL.">
            <code className="text-xs text-gray-500">{project.slug}</code>
          </SettingsRow>
          <SettingsRow label="Type" description="Detected project category.">
            <span className="text-xs text-gray-500 capitalize">{project.type}</span>
          </SettingsRow>
          <SettingsRow label="Created" description="">
            <span className="text-xs text-gray-500">{new Date(project.created_at).toLocaleDateString()}</span>
          </SettingsRow>
        </SettingsCard>

        <SettingsCard className="border-red-200">
          <SettingsRow label="Delete project" description="Permanently deletes this project, its versions, deployments, and documentation.">
            <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </SettingsRow>
        </SettingsCard>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project, its version history, deployments, and all documentation. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
