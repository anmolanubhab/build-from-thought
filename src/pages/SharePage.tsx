import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProjectBySlug, incrementViewCount, remixProject } from "@/services/db";
import { generateSlug, getProjectPages } from "@/lib/projects";
import type { Project, PageData } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Sparkles, ArrowLeft, Files } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  landing: "Landing Page",
  generic: "Web App",
};

const SharePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<(Project & { creator?: { display_name: string; username: string } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    if (!slug) return;
    fetchProjectBySlug(slug)
      .then((p) => {
        setProject(p);
        incrementViewCount(p.id);
      })
      .catch(() => setError("Project not found or is private."))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleRemix = async () => {
    if (!user) { navigate("/login"); return; }
    if (!project) return;
    setRemixing(true);
    try {
      const newSlug = generateSlug(project.title + " remix");
      await remixProject(project, user.id, newSlug);
      toast({ title: "Remixed!", description: "Project cloned to your dashboard." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Remix failed", description: err.message, variant: "destructive" });
    } finally {
      setRemixing(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Project not found</h1>
          <p className="text-muted-foreground mb-4">{error || "This project may be private or doesn't exist."}</p>
          <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Go Home</Button>
        </div>
      </div>
    );
  }

  const pages = getProjectPages(project);
  const isMultipage = project.is_multipage && pages.length > 1;
  const currentPageIndex = Math.min(activePage, pages.length - 1);
  const currentPage = pages[currentPageIndex];

  const previewHtml = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif}${project.css || ""}</style></head><body>${currentPage?.html || "<div style='padding:2rem;color:#94a3b8'>No preview</div>"}</body></html>`;

  return (
    <div className="min-h-screen bg-background">
      <header className="glass border-b border-border/50 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="WebdevsAI" className="h-6 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyLink} className="gap-1 text-xs">
              <Copy className="h-3 w-3" /> Copy Link
            </Button>
            <Button size="sm" onClick={handleRemix} disabled={remixing} className="gradient-bg text-primary-foreground gap-1 text-xs">
              <Sparkles className="h-3 w-3" /> {remixing ? "Remixing..." : "Remix This"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-display font-bold text-foreground">{project.title}</h1>
          <Badge variant="secondary" className="text-xs">{typeLabels[project.type] || project.type}</Badge>
          {isMultipage && (
            <Badge variant="outline" className="text-xs gap-1">
              <Files className="h-2.5 w-2.5" /> {pages.length} pages
            </Badge>
          )}
        </div>
        {project.creator && (
          <p className="text-sm text-muted-foreground mb-4">
            Created by <span className="text-foreground font-medium">{project.creator.display_name}</span>
            {project.view_count > 0 && <> · {project.view_count} views</>}
          </p>
        )}

        {project.deployed_url && (
          <a href={project.deployed_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4">
            <ExternalLink className="h-3 w-3" /> Open Live Site
          </a>
        )}

        {/* Page switcher */}
        {isMultipage && (
          <div className="flex items-center gap-1 mb-4 overflow-x-auto">
            {pages.map((page, idx) => (
              <button
                key={page.name}
                onClick={() => setActivePage(idx)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  currentPageIndex === idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {page.title || page.name}
              </button>
            ))}
          </div>
        )}

        <div className="glass rounded-xl overflow-hidden">
          <iframe srcDoc={previewHtml} className="w-full h-[70vh] border-0 bg-white rounded-xl" sandbox="allow-same-origin" title="Project Preview" />
        </div>
      </div>
    </div>
  );
};

export default SharePage;
