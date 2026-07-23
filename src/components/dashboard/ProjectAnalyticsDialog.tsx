// path: src/components/dashboard/ProjectAnalyticsDialog.tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Eye, Rocket, Database, FileText, History, Loader2, ExternalLink } from "lucide-react";
import { fetchProjectAnalytics, type ProjectAnalytics } from "@/services/projectInsights";
import type { Project } from "@/lib/projects";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

function Stat({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--wb-line)", background: "var(--wb-surface-raised)" }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--wb-text-muted)" }}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--wb-text)" }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--wb-text-muted)" }}>{sub}</div>}
    </div>
  );
}

export default function ProjectAnalyticsDialog({ open, onClose, project }: Props) {
  const [data, setData] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    setData(null);
    fetchProjectAnalytics(project)
      .then(setData)
      .catch((err) => toast({ title: "Couldn't load analytics", description: err instanceof Error ? err.message : undefined, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, project]);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: "var(--wb-text)" }}>
            <BarChart3 className="h-4 w-4" /> Analytics — {project.title}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--wb-text-muted)" }} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={Eye} label="Views" value={String(data.viewCount)} />
              <Stat icon={History} label="Saved versions" value={String(data.versionCount)} />
              <Stat
                icon={Rocket}
                label="Deployments"
                value={String(data.deploymentCount)}
                sub={data.latestDeployment ? `Last: ${data.latestDeployment.status}` : "Never deployed"}
              />
              <Stat
                icon={Database}
                label="Database"
                value={data.database ? data.database.status : "Not connected"}
                sub={data.database ? `${data.database.mode} · ${data.database.tableCount} table${data.database.tableCount === 1 ? "" : "s"}` : undefined}
              />
              <Stat
                icon={FileText}
                label="Documentation"
                value={`${data.documentation.generated}/${data.documentation.total}`}
                sub="core sections generated"
              />
              <Stat
                icon={BarChart3}
                label="Visibility"
                value={data.isPublic ? "Public" : "Private"}
                sub={data.isStarred ? "Starred" : undefined}
              />
            </div>

            <div className="text-[11px] space-y-1 px-0.5" style={{ color: "var(--wb-text-muted)" }}>
              <div>Created {new Date(data.createdAt).toLocaleString()}</div>
              {data.updatedAt && <div>Last updated {new Date(data.updatedAt).toLocaleString()}</div>}
              <div>Type: {data.type} · Stack: {data.stack} · {data.isMultipage ? "Multi-page" : "Single-page"}</div>
            </div>

            {data.latestDeployment?.url && (
              <a
                href={data.latestDeployment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                Open latest deployment <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
