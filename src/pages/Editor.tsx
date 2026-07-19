import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { editProject, EditResult } from "@/services/edit";
import type { Project, PageData } from "@/lib/projects";
import { getProjectPages } from "@/lib/projects";
import PromptPanel, { PromptEntry } from "@/components/editor/PromptPanel";
import PreviewPanel from "@/components/editor/PreviewPanel";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProjectSnapshot {
  html: string;
  css: string;
  react_code: string;
  pages?: PageData[] | null;
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<PromptEntry[]>([]);
  const [undoStack, setUndoStack] = useState<ProjectSnapshot[]>([]);
  const [previewChanges, setPreviewChanges] = useState<EditResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(!isMobile);

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
      setProject(data as unknown as Project);
      setLoading(false);
    })();
  }, [id, user, navigate]);

  const saveProjectToDB = useCallback(
    async (html: string, css: string, react_code: string, pages?: PageData[] | null) => {
      if (!id) return;
      await supabase
        .from("projects")
        .update({ html, css, react_code, pages: pages as any, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
    },
    [id]
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
        mode
      );

      if (mode === "suggest") {
        setPreviewChanges(result);
        setHistory((prev) => prev.map((e) => e.id === entryId ? { ...e, status: "success", summary: "Preview ready" } : e));
      } else {
        setUndoStack((prev) => [
          ...prev,
          { html: project.html || "", css: project.css || "", react_code: project.react_code || "", pages: project.pages },
        ]);

        const updated: Project = { ...project, html: result.html, css: result.css, react_code: result.react_code };
        setProject(updated);
        await saveProjectToDB(result.html, result.css, result.react_code, project.pages);

        setHistory((prev) => prev.map((e) => e.id === entryId ? { ...e, status: "success", summary: result.summary, changes: result.changes } : e));
        toast({ title: "Changes applied", description: result.summary });
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

    const updated: Project = { ...project, html: prev.html, css: prev.css, react_code: prev.react_code, pages: prev.pages };
    setProject(updated);
    await saveProjectToDB(prev.html, prev.css, prev.react_code, prev.pages);
    toast({ title: "Change undone" });
  };

  const handleAcceptPreview = async () => {
    if (!previewChanges || !project) return;
    setUndoStack((prev) => [
      ...prev,
      { html: project.html || "", css: project.css || "", react_code: project.react_code || "", pages: project.pages },
    ]);

    const updated: Project = { ...project, html: previewChanges.html, css: previewChanges.css, react_code: previewChanges.react_code };
    setProject(updated);
    await saveProjectToDB(previewChanges.html, previewChanges.css, previewChanges.react_code, project.pages);
    setPreviewChanges(null);
    toast({ title: "Changes accepted", description: previewChanges.summary });
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
        {isMobile && (
          <button onClick={() => setPanelOpen(!panelOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            {panelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`${isMobile ? "absolute inset-0 z-30" : "w-[360px] flex-shrink-0 border-r border-gray-200"} ${isMobile && !panelOpen ? "hidden" : ""} transition-all`}>
          <PromptPanel history={history} loading={editing} onSubmit={handleSubmit} onUndo={handleUndo} canUndo={undoStack.length > 0} />
        </div>
        <div className="flex-1 min-w-0">
          <PreviewPanel
            html={project.html || ""}
            css={project.css || ""}
            title={project.title}
            pages={pages}
            previewChanges={previewChanges ? {
              summary: previewChanges.summary,
              changes: previewChanges.changes,
              html: previewChanges.html,
              css: previewChanges.css,
            } : null}
            onAcceptPreview={handleAcceptPreview}
            onRejectPreview={() => setPreviewChanges(null)}
          />
        </div>
      </div>
    </div>
  );
}
