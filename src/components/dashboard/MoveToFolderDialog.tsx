// path: src/components/dashboard/MoveToFolderDialog.tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderInput, Folder, FolderX, Loader2, Plus } from "lucide-react";
import { fetchWorkspaceFolders, moveProjectToFolder } from "@/services/db";
import type { Project } from "@/lib/projects";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  workspaceId: string | null;
  onMoved: (project: Project) => void;
}

export default function MoveToFolderDialog({ open, onClose, project, workspaceId, onMoved }: Props) {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoading(true);
    setNewFolder("");
    fetchWorkspaceFolders(workspaceId)
      .then(setFolders)
      .catch((err) => toast({ title: "Couldn't load folders", description: err instanceof Error ? err.message : undefined, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  if (!project) return null;

  const move = async (folder: string | null) => {
    setSaving(folder ?? "__none__");
    try {
      const updated = await moveProjectToFolder(project.id, folder);
      onMoved(updated);
      toast({ title: folder ? `Moved to "${folder}"` : "Removed from folder" });
      onClose();
    } catch (err) {
      toast({ title: "Couldn't move project", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const createAndMove = () => {
    const trimmed = newFolder.trim();
    if (!trimmed) return;
    move(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-sm"
        style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: "var(--wb-text)" }}>
            <FolderInput className="h-4 w-4" /> Move "{project.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createAndMove(); }}
              placeholder="New folder name…"
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8 gap-1 shrink-0" disabled={!newFolder.trim() || !!saving} onClick={createAndMove}>
              {saving === newFolder.trim() ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            <button
              onClick={() => move(null)}
              disabled={!!saving}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors hover:bg-accent disabled:opacity-50"
              style={{ color: !project.folder ? "var(--wb-circuit)" : "var(--wb-text)" }}
            >
              {saving === "__none__" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderX className="h-3.5 w-3.5" />}
              No folder
            </button>

            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--wb-text-muted)" }} /></div>
            ) : folders.length === 0 ? (
              <p className="text-xs px-2.5 py-2" style={{ color: "var(--wb-text-muted)" }}>No folders yet — create one above.</p>
            ) : (
              folders.map((f) => (
                <button
                  key={f}
                  onClick={() => move(f)}
                  disabled={!!saving}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors hover:bg-accent disabled:opacity-50 truncate"
                  style={{ color: project.folder === f ? "var(--wb-circuit)" : "var(--wb-text)" }}
                >
                  {saving === f ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{f}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
