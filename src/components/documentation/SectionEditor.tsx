// path: src/components/documentation/SectionEditor.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Heading2, List, ListOrdered, Code, Link2, Eye, Pencil, Columns2,
  History, Loader2, Check,
} from "lucide-react";
import { getSectionMeta, STRUCTURED_SECTIONS } from "@/lib/documentation/registry";
import { renderMarkdownToHtml } from "@/lib/documentation/markdown";
import { generateSection, saveManualEdit, acknowledgeUpToDate } from "@/services/documentation";
import type {
  DocumentationSection, DocSectionKey, ExplainAudience, GenerationMode, VivaContentJson,
} from "@/lib/documentation/types";
import GenerateButton from "./GenerateButton";
import ExportMenu from "./ExportMenu";
import OutdatedBanner from "./OutdatedBanner";
import TableOfContents from "./TableOfContents";
import VivaModeView from "./VivaModeView";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type ViewMode = "edit" | "preview" | "split";

interface Props {
  projectId: string;
  sectionKey: DocSectionKey;
  section: DocumentationSection | undefined;
  fingerprint: string;
  outdated: boolean;
  onSectionChange: (section: DocumentationSection) => void;
  onOpenHistory: () => void;
  onSyncReadme?: (content: string) => void;
}

const AUTOSAVE_DELAY = 1200;

export default function SectionEditor({
  projectId, sectionKey, section, fingerprint, outdated, onSectionChange, onOpenHistory, onSyncReadme,
}: Props) {
  const meta = getSectionMeta(sectionKey);
  const [title, setTitle] = useState(section?.title || meta.label);
  const [contentMd, setContentMd] = useState(section?.content_md || "");
  const [viewMode, setViewMode] = useState<ViewMode>(section?.content_md ? "preview" : "edit");
  const [generating, setGenerating] = useState(false);
  const [syncingOutdated, setSyncingOutdated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local editor state when the user switches which section they're
  // looking at — NOT on every prop update (autosave/generate already update
  // local state directly, so re-deriving here would just flicker/race).
  useEffect(() => {
    setTitle(section?.title || meta.label);
    setContentMd(section?.content_md || "");
    setViewMode(section?.content_md ? "preview" : "edit");
    dirtyRef.current = false;
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  const flushSave = useCallback(async (nextTitle: string, nextContent: string) => {
    setSaveState("saving");
    try {
      const saved = await saveManualEdit(projectId, sectionKey, { title: nextTitle, content_md: nextContent });
      onSectionChange(saved);
      setSaveState("saved");
    } catch (err) {
      toast({ title: "Autosave failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setSaveState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sectionKey]);

  const scheduleAutosave = useCallback((nextTitle: string, nextContent: string) => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        flushSave(nextTitle, nextContent);
      }
    }, AUTOSAVE_DELAY);
  }, [flushSave]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleContentChange = (value: string) => {
    setContentMd(value);
    scheduleAutosave(title, value);
  };

  const handleTitleBlur = () => {
    if (title !== (section?.title || meta.label)) scheduleAutosave(title, contentMd);
  };

  const forceSaveNow = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirtyRef.current = false;
    flushSave(title, contentMd);
  };

  const handleGenerate = async (mode: GenerationMode, extra?: { audience?: ExplainAudience }) => {
    setGenerating(true);
    try {
      const result = await generateSection({
        projectId, sectionKey, mode, fingerprint,
        existingMarkdown: mode !== "generate" ? contentMd : undefined,
        audience: extra?.audience,
      });
      setTitle(result.title);
      setContentMd(result.content_md);
      setViewMode("preview");
      onSectionChange(result);
      toast({ title: mode === "merge" ? "AI changes merged in" : "Documentation generated" });
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeepManual = async () => {
    if (!section) return;
    setSyncingOutdated(true);
    try {
      const updated = await acknowledgeUpToDate(section, fingerprint);
      onSectionChange(updated);
      toast({ title: "Marked as up to date" });
    } catch (err) {
      toast({ title: "Couldn't update", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSyncingOutdated(false);
    }
  };

  const wrapSelection = (prefix: string, suffix = prefix, placeholder = "text") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = contentMd.slice(start, end) || placeholder;
    const next = contentMd.slice(0, start) + prefix + selected + suffix + contentMd.slice(end);
    handleContentChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = contentMd.lastIndexOf("\n", start - 1) + 1;
    const next = contentMd.slice(0, lineStart) + prefix + contentMd.slice(lineStart);
    handleContentChange(next);
    requestAnimationFrame(() => el.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); forceSaveNow(); }
    else if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); setViewMode((m) => (m === "edit" ? "preview" : "edit")); }
    else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); wrapSelection("**"); }
    else if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); wrapSelection("*"); }
  };

  const hasContent = !!contentMd.trim();
  const hasManualEdits = !!section?.has_manual_edits;
  const contentJson = section?.content_json as unknown as VivaContentJson | undefined;
  const isStructured = STRUCTURED_SECTIONS.includes(sectionKey) && contentJson?.categories?.length;

  return (
    <div className="h-full flex flex-col min-w-0" style={{ background: "var(--wb-canvas)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--wb-line)" }}>
        <meta.icon className="h-4 w-4 shrink-0" style={{ color: "var(--wb-circuit)" }} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="text-base font-semibold wb-display bg-transparent outline-none min-w-0 flex-1"
          style={{ color: "var(--wb-text)" }}
          placeholder={meta.label}
        />
        <div className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--wb-text-muted)" }}>
          {saveState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
          {saveState === "saved" && <><Check className="h-3 w-3" /> Saved</>}
          {section?.generated_at && saveState === "idle" && <span>Last generated {new Date(section.generated_at).toLocaleDateString()}</span>}
        </div>
        <button onClick={onOpenHistory} className="p-1.5 rounded-lg transition-colors shrink-0" title="Version history" style={{ color: "var(--wb-text-muted)" }}>
          <History className="h-4 w-4" />
        </button>
        <ExportMenu title={title} contentMd={contentMd} sectionKey={sectionKey} onSyncReadme={onSyncReadme ? () => onSyncReadme(contentMd) : undefined} />
        <GenerateButton sectionKey={sectionKey} hasContent={hasContent} hasManualEdits={hasManualEdits} generating={generating} onGenerate={handleGenerate} />
      </div>

      {outdated && section && (
        <OutdatedBanner
          busy={generating || syncingOutdated}
          hasManualEdits={hasManualEdits}
          onRegenerate={() => handleGenerate("regenerate")}
          onMerge={() => handleGenerate("merge")}
          onKeepManual={handleKeepManual}
        />
      )}

      <p className="px-4 pt-2 text-xs" style={{ color: "var(--wb-text-muted)" }}>
        Generate analyzes: {meta.analyzes}
      </p>

      {/* Toolbar */}
      {!isStructured && (
        <div className="px-3 py-1.5 flex items-center gap-0.5 border-b flex-wrap" style={{ borderColor: "var(--wb-line)" }}>
          {[
            { icon: Bold, action: () => wrapSelection("**"), title: "Bold (⌘B)" },
            { icon: Italic, action: () => wrapSelection("*"), title: "Italic (⌘I)" },
            { icon: Heading2, action: () => insertLinePrefix("## "), title: "Heading" },
            { icon: List, action: () => insertLinePrefix("- "), title: "Bullet list" },
            { icon: ListOrdered, action: () => insertLinePrefix("1. "), title: "Numbered list" },
            { icon: Code, action: () => wrapSelection("`"), title: "Inline code" },
            { icon: Link2, action: () => wrapSelection("[", "](https://)"), title: "Link" },
          ].map(({ icon: Icon, action, title: t }, i) => (
            <button key={i} onClick={action} title={t} className="p-1.5 rounded-md transition-colors" style={{ color: "var(--wb-text-muted)" }}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: "var(--wb-surface)" }}>
            {([
              { id: "edit", icon: Pencil, label: "Edit" },
              { id: "split", icon: Columns2, label: "Split" },
              { id: "preview", icon: Eye, label: "Preview" },
            ] as { id: ViewMode; icon: typeof Eye; label: string }[]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                style={{ background: viewMode === id ? "var(--wb-surface-raised)" : "transparent", color: viewMode === id ? "var(--wb-text)" : "var(--wb-text-muted)" }}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden flex min-w-0">
        <div className="flex-1 overflow-y-auto min-w-0" onKeyDown={handleKeyDown}>
          {isStructured ? (
            <div className="max-w-3xl mx-auto px-6 py-6">
              <VivaModeView data={contentJson as VivaContentJson} />
            </div>
          ) : !hasContent ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 gap-2">
              <p className="text-sm font-medium" style={{ color: "var(--wb-text)" }}>Nothing written yet</p>
              <p className="text-xs max-w-sm" style={{ color: "var(--wb-text-muted)" }}>
                Click "Generate {sectionKey === "ai_explain" ? "" : meta.label}" above to have AI analyze the real project and write this document, or start typing below.
              </p>
            </div>
          ) : viewMode === "edit" ? (
            <textarea
              ref={textareaRef}
              value={contentMd}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-full resize-none outline-none px-6 py-6 text-sm font-mono leading-relaxed bg-transparent"
              style={{ color: "var(--wb-text)", minHeight: "100%" }}
              spellCheck={false}
              placeholder="Start writing…"
            />
          ) : viewMode === "preview" ? (
            <article
              className="max-w-3xl mx-auto px-6 py-6 prose prose-sm dark:prose-invert prose-headings:font-display"
              style={{ color: "var(--wb-text)" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(contentMd) }}
            />
          ) : (
            <div className="h-full flex">
              <textarea
                ref={textareaRef}
                value={contentMd}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-1/2 h-full resize-none outline-none px-5 py-6 text-sm font-mono leading-relaxed border-r bg-transparent"
                style={{ color: "var(--wb-text)", borderColor: "var(--wb-line)" }}
                spellCheck={false}
              />
              <article
                className="w-1/2 h-full overflow-y-auto px-5 py-6 prose prose-sm dark:prose-invert"
                style={{ color: "var(--wb-text)" }}
                dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(contentMd) }}
              />
            </div>
          )}
        </div>

        {hasContent && !isStructured && (
          <div className="w-56 shrink-0 border-l overflow-y-auto px-3 py-4 hidden lg:block" style={{ borderColor: "var(--wb-line)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--wb-text-muted)" }}>
              On this page
            </p>
            <TableOfContents
              markdown={contentMd}
              onJump={(slug) => {
                if (viewMode === "edit") setViewMode("preview");
                requestAnimationFrame(() => {
                  document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
