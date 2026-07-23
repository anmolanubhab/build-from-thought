// path: src/components/documentation/GenerateAllDialog.tsx
//
// "Generate All" progress UI: a checklist of the 12 core sections with live
// status, an overall progress bar, and a per-failed-section Retry button.
// Backed by hooks/use-documentation-batch.ts, which persists progress to
// documentation_generation_jobs after every section — closing this dialog
// mid-run does not lose progress (it's already saved server-side), and
// reopening the Documentation Center later offers Resume.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, Loader2, AlertCircle, Sparkles, RotateCcw } from "lucide-react";
import type { DocSectionKey, DocumentationSection } from "@/lib/documentation/types";
import { getSectionMeta } from "@/lib/documentation/registry";
import { useDocumentationBatch } from "@/hooks/use-documentation-batch";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  fingerprint: string;
  sectionsByKey: Map<DocSectionKey, DocumentationSection>;
  onSectionChange: (section: DocumentationSection) => void;
}

export default function GenerateAllDialog({ open, onClose, projectId, fingerprint, sectionsByKey, onSectionChange }: Props) {
  const [force, setForce] = useState(false);
  const { sectionStatus, running, hasResumableJob, targetKeys, completedCount, failedKeys, run, retry } =
    useDocumentationBatch({ projectId, fingerprint, sectionsByKey, onSectionChange });

  const total = targetKeys.length;
  const progressPct = total ? Math.round((completedCount / total) * 100) : 0;
  const started = targetKeys.some((k) => sectionStatus[k]);

  const startLabel = running
    ? "Generating…"
    : hasResumableJob
      ? `Resume (${total - completedCount} remaining)`
      : force
        ? "Regenerate All"
        : "Generate All";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0" style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}>
        <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: "var(--wb-line)" }}>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: "var(--wb-text)" }}>
            <Sparkles className="h-4 w-4" style={{ color: "var(--wb-circuit)" }} /> Generate All Documentation
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--wb-text-muted)" }}>
            <span>{completedCount} of {total} sections{failedKeys.length ? ` · ${failedKeys.length} failed` : ""}</span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
          <p className="text-xs mt-2" style={{ color: "var(--wb-text-muted)" }}>
            Generates each section one at a time, in its own AI request. Already up-to-date sections are skipped.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {targetKeys.map((key) => {
            const meta = getSectionMeta(key);
            const entry = sectionStatus[key];
            const status = entry?.status ?? "pending";
            return (
              <div key={key} className="flex items-center gap-2.5 py-1.5">
                {status === "completed" && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#10B981" }} />}
                {status === "running" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--wb-circuit)" }} />}
                {status === "failed" && <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#EF4444" }} />}
                {status === "pending" && <Circle className="h-4 w-4 shrink-0" style={{ color: "var(--wb-text-muted)" }} />}

                <meta.icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--wb-text-muted)" }} />
                <span className="flex-1 text-sm truncate" style={{ color: "var(--wb-text)" }}>{meta.label}</span>

                {status === "failed" && (
                  <>
                    <span className="text-[11px] truncate max-w-[140px]" style={{ color: "#EF4444" }} title={entry?.error}>
                      {entry?.error || "Failed"}
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 shrink-0" disabled={running} onClick={() => retry(key)}>
                      <RotateCcw className="h-3 w-3" /> Retry
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t flex items-center gap-3 shrink-0" style={{ borderColor: "var(--wb-line)" }}>
          <label className="flex items-center gap-2 text-xs flex-1" style={{ color: "var(--wb-text-muted)" }}>
            <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} disabled={running} />
            Force regenerate all (ignore up-to-date sections)
          </label>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button
            size="sm"
            disabled={running || (started && total > 0 && completedCount === total && !force && failedKeys.length === 0)}
            onClick={() => run({ force })}
            className="gap-1.5"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {startLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
