// path: src/components/editor/VersionHistoryDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { fetchVersionHistory, publishVersion, type ProjectVersion } from "@/services/versions";
import { CheckCircle2, RotateCcw, ExternalLink, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onRolledBack: () => void;
}

export default function VersionHistoryDialog({ open, onClose, projectId, onRolledBack }: Props) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchVersionHistory(projectId)
        .then(setVersions)
        .catch((err) => toast({ title: "Couldn't load history", description: err instanceof Error ? err.message : undefined, variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [open, projectId]);

  const handleRollback = async (version: ProjectVersion) => {
    setRollingBackId(version.id);
    try {
      await publishVersion(version.id);
      toast({ title: `Rolled back to v${version.version_number}` });
      onRolledBack();
      const refreshed = await fetchVersionHistory(projectId);
      setVersions(refreshed);
    } catch (err) {
      toast({
        title: "Rollback failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-auto">
          {loading && <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>}
          {!loading && versions.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No versions yet.</p>
          )}
          {versions.map((v) => (
            <div key={v.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  Version {v.version_number}
                  {v.status === "live" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" /> Live
                    </span>
                  )}
                  {v.status === "draft" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Draft</span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
              {v.summary && <p className="text-xs text-muted-foreground">{v.summary}</p>}
              <div className="flex items-center gap-3 pt-0.5">
                {v.preview_url && (
                  <a href={v.preview_url} target="_blank" rel="noreferrer" className="text-[11px] text-violet-600 hover:underline inline-flex items-center gap-0.5">
                    Preview <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {v.status === "archived" && (
                  <button
                    onClick={() => handleRollback(v)}
                    disabled={rollingBackId === v.id}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> {rollingBackId === v.id ? "Rolling back..." : "Rollback to this version"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
