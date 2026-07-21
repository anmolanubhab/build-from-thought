// path: src/pages/Editor.tsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu, X, History, Eye, Rocket, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { editProject, EditResult } from "@/services/edit";
import type { Project, PageData } from "@/lib/projects";
import { getProjectPages } from "@/lib/projects";
import {
  fetchOpenDraft, createDraft, updateDraft, discardDraft, publishVersion,
  createPreviewDeployment, type ProjectVersion,
} from "@/services/versions";
import PromptPanel, { PromptEntry } from "@/components/editor/PromptPanel";
import PreviewPanel from "@/components/editor/PreviewPanel";
import VersionHistoryDialog from "@/components/editor/VersionHistoryDialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProjectSnapshot {
  html: string;
  css: string;
  react_code: string;
  pages?: PageData[] | null;
  files?: Record<string, string> | null;
}

/** Short ascending two-tone chime, synthesized client-side so no audio asset is needed. */
function playGenerationCompleteSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(660, 0, 0.12);
    playTone(880, 0.1, 0.16);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Best-effort: sound is a nicety, never block on it.
  }
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [project, setProject] = useState<Project | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<PromptEntry[]>([]);
  const [undoStack, setUndoStack] = useState<ProjectSnapshot[]>([]);
  const [previewChanges, setPreviewChanges] = useState<EditResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(!isMobile);

  const [draft, setDraft] = useState<ProjectVersion | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prefs, setPrefs] = useState<{ chat_suggestions_enabled: boolean; generation_sound_enabled: boolean } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("chat_suggestions_enabled, generation_sound_enabled")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setPrefs(data as unknown as { chat_suggestions_enabled: boolean; generation_sound_enabled: boolean });
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        toast({ title: "Project not found", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      const loaded = data as unknown as Project;
      setProject(loaded);
      setLiveSnapshot({ html: loaded.html || "", css: loaded.css || "", react_code: loaded.react_code || "", pages: loaded.pages, files: loaded.files ?? null });

      // Resume an in-progress draft, if one exists, so a refresh doesn't lose it.
      try {
        const openDraft = await fetchOpenDraft(id);
        if (openDraft) {
          setDraft(openDraft);
          setProject((prev) => prev ? { ...prev, html: openDraft.html || "", css: openDraft.css || "", react_code: openDraft.react_code || "", pages: openDraft.pages, files: openDraft.files ?? prev.files } : prev);
        }
      } catch (err) {
        console.error("Failed to load open draft:", err);
      }

      setLoading(false);
    })();
  }, [id, user, navigate]);

  const saveDraft = useCallback(
    async (html: string, css: string, react_code: string, pages: PageData[] | null | undefined, summary: string, files?: Record<string, string> | null) => {
      if (!id) return;
      if (draft) {
        const updated = await updateDraft(draft.id, { html, css, react_code, pages, files }, summary);
        setDraft(updated);
      } else {
        const created = await createDraft(id, { html, css, react_code, pages, files }, summary);
        setDraft(created);
      }
    },
    [id, draft]
  );

  const handleSubmit = async (prompt: string, mode: "apply" | "suggest") => {
    if (!project) return;
    setEditing(true);

    const entryId = crypto.randomUUID();
    const entry: PromptEntry = { id: entryId, text: prompt, timestamp: new Date(), status: "pending" };
    setHistory((prev) => [...prev, entry]);

    try {
      const result = await editProject(
        prompt,
        project.html || "",
        project.css || "",
        project.react_code || "",
        mode,
        project.files ?? null,
        project.plan ?? null
      );

      if (mode === "suggest") {
        setPreviewChanges(result);
        setHistory((prev) => prev.map((e) => e.id === entryId ? { ...e, status: "success", summary: "Preview ready" } : e));
        if (prefs?.generation_sound_enabled) playGenerationCompleteSound();
      } else {
        setUndoStack((prev) => [
          ...prev,
          { html: project.html || "", css: project.css || "", react_code: project.react_code || "", pages: project.pages, files: project.files ?? null },
        ]);

        const nextFiles = result.files ?? project.files ?? null;
        const updated: Project = { ...project, html: result.html, css: result.css, react_code: result.react_code, files: nextFiles };
        setProject(updated);
        await saveDraft(result.html, result.css, result.react_code, project.pages, result.summary || prompt, nextFiles);

        setHistory((prev) => prev.map((e) => e.id === entryId ? { ...e, status: "success", summary: result.summary, changes: result.changes } : e));
        toast({ title: "Draft updated", description: "Preview or publish when you're ready." });
        if (prefs?.generation_sound_enabled) playGenerationCompleteSound();
      }
    } catch (err) {
      setHistory((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: "error" } : e)));
      toast({ title: "Edit failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));

    const updated: Project = { ...project, html: prev.html, css: prev.css, react_code: prev.react_code, pages: prev.pages, files: prev.files ?? null };
    setProject(updated);
    await saveDraft(prev.html, prev.css, prev.react_code, prev.pages, "Undo", prev.files ?? null);
    toast({ title: "Change undone" });
  };

  const handleAcceptPreview = async () => {
    if (!previewChanges || !project) return;
    setUndoStack((prev) => [
      ...prev,
      { html: project.html || "", css: project.css || "", react_code: project.react_code || "", pages: project.pages, files: project.files ?? null },
    ]);

    const nextFiles = previewChanges.files ?? project.files ?? null;
    const updated: Project = { ...project, html: previewChanges.html, css: previewChanges.css, react_code: previewChanges.react_code, files: nextFiles };
    setProject(updated);
    await saveDraft(previewChanges.html, previewChanges.css, previewChanges.react_code, project.pages, previewChanges.summary, nextFiles);
    setPreviewChanges(null);
    toast({ title: "Draft updated", description: previewChanges.summary });
  };

  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      await publishVersion(draft.id);
      setLiveSnapshot({ html: draft.html || "", css: draft.css || "", react_code: draft.react_code || "", pages: draft.pages, files: draft.files ?? null });
      setDraft(null);
      toast({ title: "Published!", description: "Your changes are now live." });
    } catch (err) {
      toast({ title: "Publish failed", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!draft || !liveSnapshot) return;
    setDiscarding(true);
    try {
      await discardDraft(draft.id);
      setDraft(null);
      setProject((prev) => prev ? { ...prev, ...liveSnapshot } : prev);
      toast({ title: "Draft discarded" });
    } catch (err) {
      toast({ title: "Couldn't discard draft", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setDiscarding(false);
    }
  };

  const handlePreviewDraft = async () => {
    if (!draft || !project) return;
    setPreviewing(true);
    try {
      const result = await createPreviewDeployment(project.id, draft.id);
      window.open(result.url, "_blank");
      toast({ title: "Preview opened", description: "It may take a few seconds to finish building." });
    } catch (err) {
      toast({ title: "Preview failed", description: err instanceof Error ? err.message : "Connect Vercel first from Resources → Connectors.", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const handleRolledBack = async () => {
    if (!id || !user) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
    if (data) {
      const reloaded = data as unknown as Project;
      setProject(reloaded);
      setLiveSnapshot({ html: reloaded.html || "", css: reloaded.css || "", react_code: reloaded.react_code || "", pages: reloaded.pages, files: reloaded.files ?? null });
      setDraft(null);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const pages = getProjectPages(project);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="h-11 bg-white border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
        <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate">{project.title}</span>
        {project.is_multipage && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{pages.length} pages</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setHistoryOpen(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Version history"
        >
          <History className="h-4 w-4" />
        </button>
        {isMobile && (
          <button onClick={() => setPanelOpen(!panelOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            {panelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
      </div>

      {draft && (
        <div className="h-11 bg-amber-50 border-b border-amber-200 flex items-center px-3 gap-2 flex-shrink-0">
          <span className="text-xs font-medium text-amber-800">
            Draft · unpublished changes {draft.summary ? `— ${draft.summary}` : ""}
          </span>
          <div className="flex-1" />
          <button
            onClick={handlePreviewDraft}
            disabled={previewing}
            className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 px-2 py-1 rounded-md hover:bg-amber-100 transition-colors"
          >
            {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Preview
          </button>
          <button
            onClick={handleDiscardDraft}
            disabled={discarding}
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Discard
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md transition-colors"
          >
            {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />} Publish
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`${isMobile ? "absolute inset-0 z-30" : "w-[360px] flex-shrink-0 border-r border-gray-200"} ${isMobile && !panelOpen ? "hidden" : ""} transition-all`}>
          <PromptPanel history={history} loading={editing} onSubmit={handleSubmit} onUndo={handleUndo} canUndo={undoStack.length > 0} suggestionsEnabled={prefs?.chat_suggestions_enabled ?? true} />
        </div>
        <div className="flex-1 min-w-0">
          <PreviewPanel
            html={project.html || ""}
            css={project.css || ""}
            title={project.title}
            pages={pages}
            files={project.files ?? null}
            previewChanges={previewChanges ? {
              summary: previewChanges.summary,
              changes: previewChanges.changes,
              html: previewChanges.html,
              css: previewChanges.css,
              files: previewChanges.files ?? null,
            } : null}
            onAcceptPreview={handleAcceptPreview}
            onRejectPreview={() => setPreviewChanges(null)}
          />
        </div>
      </div>

      <VersionHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        projectId={project.id}
        onRolledBack={handleRolledBack}
      />
    </div>
  );
}
