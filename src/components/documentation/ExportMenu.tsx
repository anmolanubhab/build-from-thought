// path: src/components/documentation/ExportMenu.tsx
import { useState } from "react";
import { Download, ChevronDown, FileText, FileCode, FileType, Printer, Github, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { downloadMarkdown, downloadHtml, downloadPdf, downloadDocx, printDocument, downloadReadme } from "@/lib/documentation/export";
import type { DocSectionKey } from "@/lib/documentation/types";
import { toast } from "@/hooks/use-toast";

interface Props {
  title: string;
  contentMd: string;
  sectionKey: DocSectionKey;
  onSyncReadme?: () => void;
}

export default function ExportMenu({ title, contentMd, sectionKey, onSyncReadme }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const doc = { title, content_md: contentMd };
  const disabled = !contentMd.trim();

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
          style={{ borderColor: "var(--wb-line)", color: "var(--wb-text)" }}
        >
          <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("md", () => downloadMarkdown(doc, title))}>
          {busy === "md" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("html", () => downloadHtml(doc, title))}>
          {busy === "html" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCode className="h-3.5 w-3.5" />} HTML (.html)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("pdf", () => downloadPdf(doc, title))}>
          {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5" />} PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("docx", () => downloadDocx(doc, title))}>
          {busy === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5" />} Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("print", () => printDocument(doc))}>
          {busy === "print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print
        </DropdownMenuItem>
        {sectionKey === "readme" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("readme", () => downloadReadme(doc))}>
              <Github className="h-3.5 w-3.5" /> Download as README.md
            </DropdownMenuItem>
            {onSyncReadme && (
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => run("sync", onSyncReadme)}>
                {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />} Sync into project files
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
