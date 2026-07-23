// path: src/components/dashboard/ProjectCard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Project, generateSlug } from "@/lib/projects";
import { toggleStar, updateProject, remixProject, insertProject } from "@/services/db";
import { resolveDefaultWorkspaceId } from "@/services/workspaces";
import { downloadProject } from "@/services/export";
import { isProjectPinned, toggleProjectPinned } from "@/lib/pinnedProjects";
import { Pencil, MoreHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProjectActionMenu } from "./ProjectActionMenu";
import MoveToFolderDialog from "./MoveToFolderDialog";
import ProjectAnalyticsDialog from "./ProjectAnalyticsDialog";
import ProjectActivityDialog from "./ProjectActivityDialog";

const typeLabels: Record<string, string> = {
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  landing: "Landing Page",
  generic: "Web App",
};

interface Props {
  project: Project;
  onOpen: (p: Project, opts?: { tab?: "preview" | "code"; device?: "desktop" | "tablet" | "mobile" }) => void;
  onDelete?: (id: string) => void;
  /** Star/pin/rename/publish toggles — any in-place field update on this project. */
  onProjectUpdate?: (p: Project) => void;
  /** Remix or Duplicate creating a brand-new project. */
  onProjectCreated?: (p: Project) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProjectCard({ project, onOpen, onDelete, onProjectUpdate, onProjectCreated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [starring, setStarring] = useState(false);
  const [pinned, setPinned] = useState(() => isProjectPinned(project.id));
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.title);
  const [busyAction, setBusyAction] = useState<"remix" | "duplicate" | null>(null);
  const [movingFolder, setMovingFolder] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    if (!renaming) setRenameValue(project.title);
  }, [project.title, renaming]);

  const handleToggleStar = async () => {
    if (starring) return;
    setStarring(true);
    try {
      const updated = await toggleStar(project.id, !project.is_starred);
      onProjectUpdate?.(updated);
    } catch (err) {
      toast({
        title: "Couldn't update star",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setStarring(false);
    }
  };

  const handleTogglePin = () => {
    const next = toggleProjectPinned(project.id);
    setPinned(next);
    toast({ title: next ? "Pinned to top" : "Unpinned" });
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    setRenaming(false);
    if (!trimmed || trimmed === project.title) {
      setRenameValue(project.title);
      return;
    }
    try {
      const updated = await updateProject(project.id, { title: trimmed });
      onProjectUpdate?.(updated);
      toast({ title: "Project renamed" });
    } catch (err) {
      toast({
        title: "Rename failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
      setRenameValue(project.title);
    }
  };

  const handleRemix = async () => {
    if (!user?.id || busyAction) return;
    setBusyAction("remix");
    try {
      const created = await remixProject(project, user.id, generateSlug(project.title));
      onProjectCreated?.(created);
      toast({ title: "Remixed", description: `Created "${created.title}".` });
    } catch (err) {
      toast({
        title: "Remix failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicate = async () => {
    if (!user?.id || busyAction) return;
    setBusyAction("duplicate");
    try {
      const workspaceId = await resolveDefaultWorkspaceId();
      const created = await insertProject({
        user_id: user.id,
        workspace_id: workspaceId,
        title: `${project.title} (Copy)`,
        type: project.type,
        prompt: project.prompt,
        slug: generateSlug(project.title),
        html: project.html,
        css: project.css,
        react_code: project.react_code,
        is_multipage: project.is_multipage,
        pages: project.pages,
        files: project.files ?? null,
        stack: project.stack ?? "static",
        plan: project.plan ?? null,
      });
      onProjectCreated?.(created);
      toast({ title: "Duplicated", description: `Created "${created.title}".` });
    } catch (err) {
      toast({
        title: "Duplicate failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadZip = async () => {
    try {
      await downloadProject(project);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const shareUrl = () => `${window.location.origin}/share/${project.slug}`;

  const handleShare = async () => {
    const url = shareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: project.title, url });
        return;
      } catch {
        // User cancelled the native share sheet, or it's unsupported — fall through to clipboard.
      }
    }
    navigator.clipboard.writeText(url);
    toast({
      title: "Share link copied!",
      description: !project.is_public ? "This project is private — publish it so others can open the link." : undefined,
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl());
    toast({
      title: "Link copied!",
      description: !project.is_public ? "This project is private — publish it so others can open the link." : undefined,
    });
  };

  const handleTogglePublish = async () => {
    try {
      const updated = await updateProject(project.id, { is_public: !project.is_public });
      onProjectUpdate?.(updated);
      toast({ title: updated.is_public ? "Project is now public" : "Project is now private" });
    } catch (err) {
      toast({
        title: "Couldn't update",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleOpenLivePreview = () => {
    const url = project.deployed_url || (project.is_public ? shareUrl() : null);
    if (!url) {
      toast({ title: "No live preview yet", description: "Deploy or publish this project first." });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="group rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 hover:-translate-y-1 wb-sans"
      style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
      onClick={() => onOpen(project)}
    >
      {/* Preview */}
      <div className="h-40 relative overflow-hidden" style={{ background: "var(--wb-canvas)" }}>
        {project.html ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family: system-ui, sans-serif; transform: scale(0.25); transform-origin: top left; width: 400%; height: 400%; overflow: hidden; } ${project.css || ""}</style></head><body>${project.html}</body></html>`}
            className="w-full h-full border-0 pointer-events-none"
            sandbox="allow-same-origin"
            title="Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center wb-blueprint-grid">
            <span className="wb-mono text-[11px]" style={{ color: "var(--wb-text-muted)" }}>NO PREVIEW</span>
          </div>
        )}

        {/* Spec-sheet corner label */}
        <div className="absolute bottom-2 left-2">
          <span
            className="wb-mono px-2 py-0.5 text-[10px] uppercase tracking-wide border"
            style={{ background: "rgba(14,17,22,0.85)", color: "var(--wb-circuit)", borderColor: "var(--wb-line)" }}
          >
            {typeLabels[project.type] || "Web App"}
          </span>
        </div>

        {pinned && (
          <div className="absolute bottom-2 right-2">
            <span
              className="wb-mono px-2 py-0.5 text-[10px] uppercase tracking-wide border"
              style={{ background: "rgba(14,17,22,0.85)", color: "var(--wb-ember)", borderColor: "var(--wb-line)" }}
            >
              Pinned
            </span>
          </div>
        )}

      </div>

      {/* Spec-sheet info row — title/metadata on the left, actions always
          visible on the right (not hover-only), matching the card footer. */}
      <div className="p-3 border-t flex items-start justify-between gap-2" style={{ borderColor: "var(--wb-line)" }}>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                if (e.key === "Escape") { setRenameValue(project.title); setRenaming(false); }
              }}
              className="text-sm font-semibold mb-1.5 w-full bg-transparent border-b outline-none"
              style={{ color: "var(--wb-text)", borderColor: "var(--wb-circuit)" }}
            />
          ) : (
            <h3 className="text-sm font-semibold truncate mb-1.5" style={{ color: "var(--wb-text)" }}>
              {project.title}
              {busyAction && <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--wb-text-muted)" }}>({busyAction === "remix" ? "remixing…" : "duplicating…"})</span>}
            </h3>
          )}
          <div className="wb-mono flex items-center gap-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--wb-text-muted)" }}>
            <span>{timeAgo(project.created_at)}</span>
            <span style={{ color: "var(--wb-line)" }}>·</span>
            <span>{project.is_multipage ? "Multi-page" : "Single-page"}</span>
            {project.is_public && (
              <>
                <span style={{ color: "var(--wb-line)" }}>·</span>
                <span style={{ color: "var(--wb-circuit)" }}>Public</span>
              </>
            )}
          </div>
        </div>

        {/* Quick "Edit with AI" + the full action menu — always visible, no hover-fade */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/editor/${project.id}`); }}
            className="p-1.5 rounded-md text-white transition-all duration-150 hover:scale-110"
            style={{ background: "var(--wb-circuit)", color: "#0E1116" }}
            title="Edit with AI"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <ProjectActionMenu
            project={project}
            isPinned={pinned}
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md text-white transition-all duration-150 hover:scale-110 data-[state=open]:scale-110"
                style={{ background: "rgba(14,17,22,0.7)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(14,17,22,0.95)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(14,17,22,0.7)"; }}
                aria-label="Project actions"
                title="More actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            }
            onOpen={() => navigate(`/editor/${project.id}`)}
            onOpenLivePreview={handleOpenLivePreview}
            onPreviewMobile={() => onOpen(project, { tab: "preview", device: "mobile" })}
            onRename={() => setRenaming(true)}
            onMoveToFolder={() => setMovingFolder(true)}
            onToggleStar={handleToggleStar}
            onTogglePin={handleTogglePin}
            onRemix={handleRemix}
            onDuplicate={handleDuplicate}
            onExport={() => onOpen(project, { tab: "code" })}
            onDownloadZip={handleDownloadZip}
            onShare={handleShare}
            onCopyLink={handleCopyLink}
            onTogglePublish={handleTogglePublish}
            onAnalytics={() => setShowAnalytics(true)}
            onActivity={() => setShowActivity(true)}
            onSettings={() => navigate(`/editor/${project.id}?tab=settings`)}
            onDelete={() => onDelete?.(project.id)}
          />
        </div>
      </div>

      <MoveToFolderDialog
        open={movingFolder}
        onClose={() => setMovingFolder(false)}
        project={project}
        workspaceId={project.workspace_id ?? null}
        onMoved={(updated) => onProjectUpdate?.(updated)}
      />
      <ProjectAnalyticsDialog open={showAnalytics} onClose={() => setShowAnalytics(false)} project={project} />
      <ProjectActivityDialog open={showActivity} onClose={() => setShowActivity(false)} project={project} />
    </div>
  );
}
