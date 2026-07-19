// path: src/components/dashboard/ProjectCard.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Project } from "@/lib/projects";
import { toggleStar } from "@/services/db";
import { Badge } from "@/components/ui/badge";
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
  if (hours < 24) return `Edited ${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `Edited ${days} day${days > 1 ? "s" : ""} ago`;
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
      className="group rounded-2xl overflow-hidden border border-gray-100 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
      onClick={() => onOpen(project)}
    >
      {/* Preview */}
      <div className="h-44 relative overflow-hidden bg-gray-900">
        {project.html ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family: system-ui, sans-serif; transform: scale(0.25); transform-origin: top left; width: 400%; height: 400%; overflow: hidden; } ${project.css || ""}</style></head><body>${project.html}</body></html>`}
            className="w-full h-full border-0 pointer-events-none"
            sandbox="allow-same-origin"
            title="Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-300 to-orange-300">
            <span className="text-white/60 text-xs">No preview</span>
          </div>
        )}

        {/* Published badge */}
        <div className="absolute bottom-3 left-3">
          <span className="px-2.5 py-1 rounded-md bg-gray-900/70 backdrop-blur text-white text-[11px] font-medium">
            Published
          </span>
        </div>

        {/* Star / Delete on hover */}
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/editor/${project.id}`); }}
            className="p-1.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white transition-colors"
            title="Edit with AI"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleToggleStar}
            disabled={starring}
            className={`p-1.5 rounded-lg transition-colors ${
              project.is_starred ? "bg-amber-400 text-white" : "bg-black/40 text-white hover:bg-amber-400"
            }`}
            title={project.is_starred ? "Unstar" : "Star"}
          >
            <Star className={`h-3.5 w-3.5 ${project.is_starred ? "fill-white" : ""}`} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-white font-semibold">
            {project.title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h3>
            <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500 shrink-0">
              {typeLabels[project.type] || "Web App"}
            </Badge>
          </div>
          <p className="text-[12px] text-gray-400 mt-0.5">{timeAgo(project.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
