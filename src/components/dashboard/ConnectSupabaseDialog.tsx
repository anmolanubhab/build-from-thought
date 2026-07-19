// path: src/components/dashboard/ConnectSupabaseDialog.tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  connectSupabaseWithToken, selectSupabaseProject, type SupabaseProjectOption,
} from "@/services/userSupabase";
import { ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: (ref: string, name: string) => void;
}

export default function ConnectSupabaseDialog({ open, onClose, onConnected }: Props) {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<SupabaseProjectOption[] | null>(null);
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setToken("");
    setProjects(null);
    setSelectedRef("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleValidate = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const list = await connectSupabaseWithToken(token.trim());
      if (list.length === 0) {
        toast({ title: "No projects found", description: "This token is valid but has no Supabase projects to pick from." });
      }
      setProjects(list);
    } catch (err) {
      toast({
        title: "Couldn't connect",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseProject = async () => {
    const project = projects?.find((p) => p.ref === selectedRef);
    if (!project) return;
    setLoading(true);
    try {
      await selectSupabaseProject(project.ref, project.name);
      onConnected(project.ref, project.name);
      toast({ title: "Supabase connected", description: `Using "${project.name}"` });
      handleClose();
    } catch (err) {
      toast({
        title: "Couldn't select project",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your Supabase account</DialogTitle>
          <DialogDescription>
            Paste a Supabase Personal Access Token. It's used only to list and link your projects — it's never shown again after saving.
          </DialogDescription>
        </DialogHeader>

        {!projects ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pat">Personal Access Token</Label>
              <Input
                id="pat"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="sbp_..."
              />
              <a
                href="https://supabase.com/dashboard/account/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
              >
                Get a token from your Supabase account <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-2 max-h-64 overflow-auto">
            {projects.map((p) => (
              <label
                key={p.ref}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="radio"
                  name="project"
                  value={p.ref}
                  checked={selectedRef === p.ref}
                  onChange={() => setSelectedRef(p.ref)}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.region} · {p.ref}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {!projects ? (
            <Button onClick={handleValidate} disabled={loading || !token.trim()}>
              {loading ? "Validating..." : "Connect"}
            </Button>
          ) : (
            <Button onClick={handleUseProject} disabled={loading || !selectedRef}>
              {loading ? "Saving..." : "Use this project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
