// path: src/components/dashboard/DomainManagerDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { Project } from "@/lib/projects";
import {
  fetchProjectDomains, addProjectDomain, removeProjectDomain, checkProjectDomain,
  type ProjectDomain,
} from "@/services/domains";
import { Globe, AlertTriangle, Clock, Trash2, RefreshCw, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function DomainManagerDialog({ open, onClose, project }: Props) {
  const [domains, setDomains] = useState<ProjectDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);

  const refresh = () => {
    if (project) fetchProjectDomains(project.id).then(setDomains).catch(() => {});
  };

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  const handleAdd = async () => {
    if (!project || !newDomain.trim()) return;
    setAdding(true);
    try {
      await addProjectDomain(project.id, newDomain.trim());
      setNewDomain("");
      refresh();
      toast({ title: "Domain added", description: "Follow the DNS instructions below to verify it." });
    } catch (err) {
      toast({
        title: "Couldn't add domain",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleCheck = async (domain: ProjectDomain) => {
    if (!project) return;
    setCheckingDomain(domain.domain);
    try {
      const result = await checkProjectDomain(project.id, domain.domain);
      refresh();
      toast({
        title: result.verified && !result.misconfigured ? "Domain verified" : "Not verified yet",
        description: result.verified && !result.misconfigured ? "SSL will be issued automatically." : "DNS records may still be propagating.",
      });
    } catch (err) {
      toast({
        title: "Couldn't check domain",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setCheckingDomain(null);
    }
  };

  const handleRemove = async (domain: ProjectDomain) => {
    if (!project) return;
    setRemovingDomain(domain.domain);
    try {
      await removeProjectDomain(project.id, domain.domain);
      refresh();
      toast({ title: "Domain removed" });
    } catch (err) {
      toast({
        title: "Couldn't remove domain",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRemovingDomain(null);
    }
  };

  const statusBadge = (status: ProjectDomain["status"]) => {
    if (status === "verified") {
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500"><ShieldCheck className="h-3 w-3" /> Verified · SSL active</span>;
    }
    if (status === "misconfigured") {
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500"><AlertTriangle className="h-3 w-3" /> Misconfigured</span>;
    }
    if (status === "error") {
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500"><AlertTriangle className="h-3 w-3" /> Error</span>;
    }
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><Clock className="h-3 w-3" /> Pending verification</span>;
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> Custom Domains</DialogTitle>
          <DialogDescription>Point your own domain at "{project.title}". Requires Vercel to be connected.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="www.example.com"
          />
          <Button onClick={handleAdd} disabled={adding || !newDomain.trim()}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>

        <div className="space-y-3 max-h-72 overflow-auto">
          {domains.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No custom domains yet.</p>
          )}
          {domains.map((d) => (
            <div key={d.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{d.domain}</span>
                {statusBadge(d.status)}
              </div>

              {d.error_message && (
                <p className="text-xs text-red-500">{d.error_message}</p>
              )}

              {d.status !== "verified" && Array.isArray(d.verification) && d.verification.length > 0 && (
                <div className="rounded-md bg-muted/50 p-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Add this DNS record at your domain provider:</p>
                  {d.verification.map((v, i) => (
                    <code key={i} className="block text-[11px] font-mono break-all">
                      {v.type} {v.domain} → {v.value}
                    </code>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-0.5">
                <button
                  onClick={() => handleCheck(d)}
                  disabled={checkingDomain === d.domain}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${checkingDomain === d.domain ? "animate-spin" : ""}`} /> Check status
                </button>
                <button
                  onClick={() => handleRemove(d)}
                  disabled={removingDomain === d.domain}
                  className="text-[11px] text-red-500 hover:text-red-600 inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
