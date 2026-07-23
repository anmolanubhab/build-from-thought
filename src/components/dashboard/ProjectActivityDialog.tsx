// path: src/components/dashboard/ProjectActivityDialog.tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";
import { Activity, Rocket, Database, FileText, History, PlusCircle, Pencil, Loader2 } from "lucide-react";
import { fetchProjectActivity, type ActivityEvent, type ActivityEventKind } from "@/services/projectInsights";
import type { Project } from "@/lib/projects";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

const KIND_ICON: Record<ActivityEventKind, LucideIcon> = {
  created: PlusCircle,
  updated: Pencil,
  deployment: Rocket,
  database: Database,
  documentation: FileText,
  version: History,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ProjectActivityDialog({ open, onClose, project }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    setEvents([]);
    fetchProjectActivity(project)
      .then(setEvents)
      .catch((err) => toast({ title: "Couldn't load activity", description: err instanceof Error ? err.message : undefined, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, project]);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md max-h-[75vh] flex flex-col"
        style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: "var(--wb-text)" }}>
            <Activity className="h-4 w-4" /> Activity — {project.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--wb-text-muted)" }} />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--wb-text-muted)" }}>No activity recorded yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {events.map((e, i) => {
                const Icon = KIND_ICON[e.kind];
                return (
                  <li key={i} className="flex items-start gap-2.5 px-1.5 py-2 rounded-md">
                    <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--wb-circuit)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ color: "var(--wb-text)" }}>{e.label}</p>
                      {e.detail && <p className="text-[11px] truncate" style={{ color: "var(--wb-text-muted)" }}>{e.detail}</p>}
                    </div>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--wb-text-muted)" }}>{timeAgo(e.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
