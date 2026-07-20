// path: src/components/dashboard/CreateWorkspaceDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createWorkspace } from "@/services/workspaces";
import type { Workspace } from "@/lib/workspaces";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (workspace: Workspace) => void;
}

export default function CreateWorkspaceDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const workspace = await createWorkspace(name.trim());
      toast({ title: "Workspace created", description: `"${workspace.name}" is ready.` });
      onCreated(workspace);
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't create workspace",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--wb-surface)] border-[var(--wb-line)] sm:max-w-md wb-sans">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--wb-text)" }}>Create a new workspace</DialogTitle>
          <DialogDescription style={{ color: "var(--wb-text-muted)" }}>
            Projects you create here will be visible to everyone you invite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="workspace-name" style={{ color: "var(--wb-text-muted)" }}>Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Team"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create Workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
