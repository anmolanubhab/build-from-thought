// path: src/components/dashboard/ProjectCard.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Project } from "@/lib/projects";
import { toggleStar } from "@/services/db";
import { Star, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const typeLabels: Record<string, string> = {
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  landing: "Landing Page",
  generic: "Web App",
};

interface Props {
  project: Project;
  onOpen: (p: Project) => void;
  onDelete?: (id: string) => void;
  onStarChange?: (p: Project) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProjectCard({ project, onOpen, onDelete, onStarChange }: Props) {
  const navigate = useNavigate();
  const [starring, setStarring] = useState(false);

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (starring) return;
    setStarring(true);
    try {
      const updated = await toggleStar(project.id, !project.is_starred);
      onStarChange?.(updated);
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

        {/* Actions on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/editor/${project.id}`); }}
            className="p-1.5 rounded-md text-white transition-colors hover:opacity-90"
            style={{ background: "var(--wb-circuit)", color: "#0E1116" }}
            title="Edit with AI"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleToggleStar}
            disabled={starring}
            className="p-1.5 rounded-md transition-colors"
            style={{
              background: project.is_starred ? "var(--wb-ember)" : "rgba(14,17,22,0.7)",
              color: "white",
            }}
            title={project.is_starred ? "Unstar" : "Star"}
          >
            <Star className="h-3.5 w-3.5" fill={project.is_starred ? "white" : "none"} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="p-1.5 rounded-md text-white transition-colors hover:opacity-90"
              style={{ background: "#E24B4A" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Spec-sheet info row */}
      <div className="p-3 border-t" style={{ borderColor: "var(--wb-line)" }}>
        <h3 className="text-sm font-semibold truncate mb-1.5" style={{ color: "var(--wb-text)" }}>{project.title}</h3>
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
    </div>
  );
}
