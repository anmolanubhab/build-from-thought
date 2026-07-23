// path: src/components/documentation/DocumentationWorkspace.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { Project } from "@/lib/projects";
import type { DocumentationSection, DocSectionKey, GenerationMode } from "@/lib/documentation/types";
import { DEFAULT_SECTION_KEY, DOC_SECTIONS } from "@/lib/documentation/registry";
import { computeProjectFingerprint } from "@/lib/documentation/hash";
import { fetchSections, generateSection, isSectionOutdated } from "@/services/documentation";
import { useWorkbenchTheme } from "@/hooks/use-workbench-theme";
import DocSidebar, { type ActiveDocView } from "./DocSidebar";
import SectionEditor from "./SectionEditor";
import ExportsPanel from "./ExportsPanel";
import DocVersionHistoryDialog from "./DocVersionHistoryDialog";
import DocSearchCommand from "./DocSearchCommand";
import KeyboardShortcutsDialog from "./KeyboardShortcutsDialog";
import GenerateAllDialog from "./GenerateAllDialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  project: Project;
  /** Wires "Sync README into project files" back into the project's file map (README.md at repo root). */
  onSyncFileToProject?: (path: string, content: string, summary: string) => Promise<void> | void;
}

export default function DocumentationWorkspace({ project, onSyncFileToProject }: Props) {
  const { theme, toggleTheme } = useWorkbenchTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = (searchParams.get("docSection") as ActiveDocView) || DEFAULT_SECTION_KEY;

  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [fingerprint, setFingerprint] = useState<string>("");
  const [historySection, setHistorySection] = useState<DocumentationSection | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [generateAllOpen, setGenerateAllOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSections(project.id)
      .then((rows) => { if (!cancelled) setSections(rows); })
      .catch((err) => toast({ title: "Couldn't load documentation", description: err.message, variant: "destructive" }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    computeProjectFingerprint({
      files: project.files, html: project.html, css: project.css, react_code: project.react_code,
      plan: project.plan,
    }).then((fp) => { if (!cancelled) setFingerprint(fp); });
    return () => { cancelled = true; };
  }, [project.files, project.html, project.css, project.react_code, project.plan]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
      else if (!isEditable && e.key === "?") { e.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sectionsByKey = useMemo(() => {
    const map = new Map<DocSectionKey, DocumentationSection>();
    for (const s of sections) map.set(s.section_key, s);
    return map;
  }, [sections]);

  const outdatedKeys = useMemo(() => {
    const set = new Set<DocSectionKey>();
    if (!fingerprint) return set;
    for (const meta of DOC_SECTIONS) {
      if (isSectionOutdated(sectionsByKey.get(meta.key), fingerprint)) set.add(meta.key);
    }
    return set;
  }, [sectionsByKey, fingerprint]);

  const filledKeys = useMemo(() => {
    const set = new Set<DocSectionKey>();
    for (const [key, s] of sectionsByKey) if (s.content_md?.trim()) set.add(key);
    return set;
  }, [sectionsByKey]);

  const handleSelect = (view: ActiveDocView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("docSection", view);
      return next;
    });
  };

  const handleSectionChange = (updated: DocumentationSection) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const handleRegenerateAll = async () => {
    setRegeneratingAll(true);
    const toRegenerate = [...outdatedKeys].filter((k) => k !== "ai_explain" && k !== "viva_mode");
    let done = 0;
    for (const key of toRegenerate) {
      const existing = sectionsByKey.get(key);
      try {
        const mode: GenerationMode = existing?.has_manual_edits ? "merge" : "regenerate";
        const result = await generateSection({
          projectId: project.id, sectionKey: key, mode, fingerprint,
          existingMarkdown: existing?.content_md,
        });
        handleSectionChange(result);
        done += 1;
      } catch (err) {
        console.error(`Failed to regenerate ${key}:`, err);
      }
    }
    setRegeneratingAll(false);
    toast({ title: `Regenerated ${done} of ${toRegenerate.length} outdated sections` });
  };

  const activeSection = activeView !== "exports" ? sectionsByKey.get(activeView as DocSectionKey) : undefined;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--wb-canvas)" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--wb-text-muted)" }} />
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark h-full" : "h-full"} data-wb-theme={theme}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={20} minSize={14} maxSize={32}>
          <DocSidebar
            active={activeView}
            onSelect={handleSelect}
            outdatedKeys={outdatedKeys}
            filledKeys={filledKeys}
            onSearch={() => setSearchOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
            onGenerateAll={() => setGenerateAllOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </ResizablePanel>
        <ResizableHandle style={{ background: "var(--wb-line)" }} />
        <ResizablePanel defaultSize={80}>
          <div className="h-full flex flex-col min-w-0">
            {outdatedKeys.size > 0 && activeView !== "exports" && (
              <div
                className="px-4 py-1.5 text-xs flex items-center gap-2 border-b shrink-0"
                style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: "var(--wb-text-muted)" }}
              >
                <span className="flex-1">{outdatedKeys.size} section{outdatedKeys.size !== 1 ? "s" : ""} outdated across the documentation set.</span>
                <button
                  onClick={handleRegenerateAll}
                  disabled={regeneratingAll}
                  className="flex items-center gap-1 font-semibold disabled:opacity-60"
                  style={{ color: "#F59E0B" }}
                >
                  {regeneratingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Regenerate entire documentation
                </button>
              </div>
            )}
            <div className="flex-1 overflow-hidden min-w-0">
              {activeView === "exports" ? (
                <div className="h-full overflow-y-auto">
                  <ExportsPanel projectTitle={project.title} sections={sections} onOpenSection={handleSelect} />
                </div>
              ) : (
                <SectionEditor
                  projectId={project.id}
                  sectionKey={activeView as DocSectionKey}
                  section={activeSection}
                  fingerprint={fingerprint}
                  outdated={outdatedKeys.has(activeView as DocSectionKey)}
                  onSectionChange={handleSectionChange}
                  onOpenHistory={() => activeSection && setHistorySection(activeSection)}
                  onSyncReadme={
                    activeView === "readme" && onSyncFileToProject
                      ? (content: string) => onSyncFileToProject("README.md", content, "Synced README from Documentation")
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <DocVersionHistoryDialog
        open={!!historySection}
        onClose={() => setHistorySection(null)}
        section={historySection}
        onRestored={handleSectionChange}
      />
      <DocSearchCommand open={searchOpen} onOpenChange={setSearchOpen} sections={sections} onSelect={handleSelect} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <GenerateAllDialog
        open={generateAllOpen}
        onClose={() => setGenerateAllOpen(false)}
        projectId={project.id}
        fingerprint={fingerprint}
        sectionsByKey={sectionsByKey}
        onSectionChange={handleSectionChange}
      />
    </div>
  );
}
