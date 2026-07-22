// path: src/components/documentation/DocVersionHistoryDialog.tsx
import { useEffect, useState } from "react";
import { diffLines } from "diff";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, GitCompare, Loader2 } from "lucide-react";
import { fetchVersions, restoreVersion } from "@/services/documentation";
import type { DocumentationSection, DocumentationSectionVersion } from "@/lib/documentation/types";
import { toast } from "@/hooks/use-toast";

const SOURCE_LABEL: Record<string, string> = {
  manual_edit: "Manual edit",
  ai_generate: "AI generated",
  merge: "AI merge",
  restore: "Restored",
};
const SOURCE_COLOR: Record<string, string> = {
  manual_edit: "#3B82F6",
  ai_generate: "#A78BFA",
  merge: "#10B981",
  restore: "#F59E0B",
};

interface Props {
  open: boolean;
  onClose: () => void;
  section: DocumentationSection | null;
  onRestored: (section: DocumentationSection) => void;
}

export default function DocVersionHistoryDialog({ open, onClose, section, onRestored }: Props) {
  const [versions, setVersions] = useState<DocumentationSectionVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !section) return;
    setLoading(true);
    setCompareA(null);
    setCompareB(null);
    fetchVersions(section.id)
      .then(setVersions)
      .catch((err) => toast({ title: "Couldn't load version history", description: err.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, section]);

  if (!section) return null;

  const handleRestore = async (version: DocumentationSectionVersion) => {
    setRestoring(version.id);
    try {
      const updated = await restoreVersion(section, version);
      onRestored(updated);
      toast({ title: "Version restored" });
      onClose();
    } catch (err) {
      toast({ title: "Restore failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  const versionA = versions.find((v) => v.id === compareA);
  const versionB = versions.find((v) => v.id === compareB);
  const diffParts = versionA && versionB ? diffLines(versionA.content_md, versionB.content_md) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0" style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}>
        <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: "var(--wb-line)" }}>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: "var(--wb-text)" }}>
            <History className="h-4 w-4" /> Version History — {section.title || section.section_key}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--wb-text-muted)" }} /></div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--wb-text-muted)" }}>No versions yet — generate or edit this section to start building history.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--wb-line)", background: (compareA === v.id || compareB === v.id) ? "var(--wb-surface-raised)" : "transparent" }}
                >
                  <Badge style={{ background: SOURCE_COLOR[v.source] ?? "#888", color: "white" }} className="shrink-0 text-[10px]">
                    {SOURCE_LABEL[v.source] ?? v.source}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: "var(--wb-text)" }}>{v.summary || v.title}</p>
                    <p className="text-[11px]" style={{ color: "var(--wb-text-muted)" }}>{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                  <Button
                    size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 shrink-0"
                    onClick={() => (compareA === v.id ? setCompareA(null) : compareB === v.id ? setCompareB(null) : compareA ? setCompareB(v.id) : setCompareA(v.id))}
                  >
                    <GitCompare className="h-3.5 w-3.5" /> {compareA === v.id || compareB === v.id ? "Selected" : "Compare"}
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 shrink-0"
                    disabled={restoring === v.id}
                    onClick={() => handleRestore(v)}
                  >
                    {restoring === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                  </Button>
                </div>
              ))}
            </div>
          )}

          {diffParts && (
            <div className="mt-5 border rounded-lg overflow-hidden" style={{ borderColor: "var(--wb-line)" }}>
              <div className="px-3 py-2 text-xs font-medium border-b flex items-center justify-between" style={{ borderColor: "var(--wb-line)", color: "var(--wb-text-muted)" }}>
                <span>Comparing {new Date(versionA!.created_at).toLocaleString()} → {new Date(versionB!.created_at).toLocaleString()}</span>
                <button onClick={() => { setCompareA(null); setCompareB(null); }} className="underline">Clear</button>
              </div>
              <pre className="p-3 text-xs overflow-auto max-h-72 font-mono whitespace-pre-wrap">
                {diffParts.map((part, i) => (
                  <span
                    key={i}
                    style={{
                      background: part.added ? "rgba(16,185,129,0.18)" : part.removed ? "rgba(239,68,68,0.18)" : "transparent",
                      color: part.added ? "#10B981" : part.removed ? "#EF4444" : "var(--wb-text-muted)",
                      textDecoration: part.removed ? "line-through" : "none",
                    }}
                  >
                    {part.value}
                  </span>
                ))}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
