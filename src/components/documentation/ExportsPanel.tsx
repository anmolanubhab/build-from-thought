// path: src/components/documentation/ExportsPanel.tsx
import { useState } from "react";
import JSZip from "jszip";
import { Download, FileArchive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOC_SECTIONS } from "@/lib/documentation/registry";
import { downloadMarkdown, downloadHtml, downloadPdf, downloadDocx, buildBundleMarkdown } from "@/lib/documentation/export";
import type { DocumentationSection, DocSectionKey } from "@/lib/documentation/types";
import { toast } from "@/hooks/use-toast";

interface Props {
  projectTitle: string;
  sections: DocumentationSection[];
  onOpenSection: (key: DocSectionKey) => void;
}

export default function ExportsPanel({ projectTitle, sections, onOpenSection }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const filled = sections.filter((s) => s.content_md?.trim());
  const bundle = { title: `${projectTitle} — Documentation`, content_md: buildBundleMarkdown(filled) };

  const run = async (key: string, fn: () => void | Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const s of filled) {
      zip.file(`${s.section_key}.md`, s.content_md);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-docs.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <h2 className="text-lg font-semibold wb-display mb-1" style={{ color: "var(--wb-text)" }}>Exports</h2>
      <p className="text-sm mb-6" style={{ color: "var(--wb-text-muted)" }}>
        Export the full documentation package, or grab an individual section below.
      </p>

      <div className="rounded-xl border p-4 mb-6" style={{ borderColor: "var(--wb-line)", background: "var(--wb-surface)" }}>
        <p className="text-sm font-medium mb-3" style={{ color: "var(--wb-text)" }}>Full package ({filled.length} of {sections.length || DOC_SECTIONS.length} sections written)</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!filled.length || busy === "bundle-md"} onClick={() => run("bundle-md", () => downloadMarkdown(bundle, projectTitle))}>
            {busy === "bundle-md" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Markdown
          </Button>
          <Button size="sm" variant="outline" disabled={!filled.length || busy === "bundle-html"} onClick={() => run("bundle-html", () => downloadHtml(bundle, projectTitle))}>
            {busy === "bundle-html" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}HTML
          </Button>
          <Button size="sm" variant="outline" disabled={!filled.length || busy === "bundle-pdf"} onClick={() => run("bundle-pdf", () => downloadPdf(bundle, projectTitle))}>
            {busy === "bundle-pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}PDF
          </Button>
          <Button size="sm" variant="outline" disabled={!filled.length || busy === "bundle-docx"} onClick={() => run("bundle-docx", () => downloadDocx(bundle, projectTitle))}>
            {busy === "bundle-docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Word
          </Button>
          <Button size="sm" disabled={!filled.length || busy === "zip"} onClick={() => run("zip", downloadZip)}>
            {busy === "zip" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileArchive className="h-3.5 w-3.5 mr-1.5" />}ZIP (all sections)
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {DOC_SECTIONS.map((meta) => {
          const section = sections.find((s) => s.section_key === meta.key);
          const written = !!section?.content_md?.trim();
          return (
            <button
              key={meta.key}
              onClick={() => onOpenSection(meta.key)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors"
              style={{ borderColor: "var(--wb-line)" }}
            >
              <meta.icon className="h-4 w-4 shrink-0" style={{ color: "var(--wb-text-muted)" }} />
              <span className="flex-1 text-sm truncate" style={{ color: "var(--wb-text)" }}>{meta.label}</span>
              <span className="text-[11px] shrink-0" style={{ color: written ? "var(--wb-circuit)" : "var(--wb-text-muted)" }}>
                {written ? "Written" : "Not generated"}
              </span>
              <Download className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--wb-text-muted)" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
