import { useState } from "react";
import { Project, getProjectPages } from "@/lib/projects";
import { downloadProject } from "@/services/export";
import { deployProject, DeployStatus } from "@/services/deploy";
import { updateProject } from "@/services/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Code, Download, Rocket, Copy, ExternalLink, Share2, CheckCircle, XCircle, Files } from "lucide-react";
import { PushToGitHubButton } from "@/components/dashboard/GitHubButton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  landing: "Landing Page",
  generic: "Web App",
};

interface Props {
  project: Project | null;
  onClose: () => void;
  onUpdate?: (project: Project) => void;
  ghConnected?: boolean;
}

export default function ProjectModal({ project, onClose, onUpdate, ghConnected }: Props) {
  const [codeTab, setCodeTab] = useState<"html" | "react">("html");
  const [downloading, setDownloading] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);

  if (!project) return null;

  const pages = getProjectPages(project);
  const isMultipage = project.is_multipage && pages.length > 1;
  const currentPageIndex = Math.min(activePage, pages.length - 1);
  const currentPage = pages[currentPageIndex];
  const currentDeployUrl = deployedUrl || project.deployed_url;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadProject(project);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeploy = async () => {
    setDeployStatus("deploying");
    try {
      const url = await deployProject(project);
      setDeployedUrl(url);
      await updateProject(project.id, { deployed_url: url });
      onUpdate?.({ ...project, deployed_url: url });
      setDeployStatus("success");
      toast({ title: "Deployed! ✅", description: "Your project is now live." });
    } catch (err: any) {
      setDeployStatus("error");
      toast({ title: "Deploy failed ❌", description: err.message, variant: "destructive" });
    }
  };

  const handleTogglePublic = async () => {
    try {
      const updated = await updateProject(project.id, { is_public: !project.is_public });
      onUpdate?.(updated);
      toast({ title: project.is_public ? "Project is now private" : "Project is now public" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/share/${project.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Share link copied!" });
  };

  const previewHtml = `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  ${project.css || ""}
</style></head><body>${currentPage?.html || "<div style='padding:2rem;color:#94a3b8;'>No preview available</div>"}</body></html>`;

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl glass border-border/50 bg-card/95 max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-foreground truncate">{project.title}</DialogTitle>
            <Badge variant="secondary" className="text-[10px]">{typeLabels[project.type]}</Badge>
            {isMultipage && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Files className="h-2.5 w-2.5" /> {pages.length} pages
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{new Date(project.created_at).toLocaleDateString()}</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Switch id="public-toggle" checked={project.is_public} onCheckedChange={handleTogglePublic} />
                <Label htmlFor="public-toggle" className="text-xs text-muted-foreground">
                  {project.is_public ? "Public" : "Private"}
                </Label>
              </div>

              {project.is_public && (
                <Button size="sm" variant="outline" className="gap-1 text-xs border-border/50" onClick={copyShareLink}>
                  <Share2 className="h-3 w-3" /> Share
                </Button>
              )}

              <Button size="sm" variant="outline" className="gap-1 text-xs border-border/50 hover:border-primary" onClick={handleDownload} disabled={downloading}>
                <Download className="h-3 w-3" /> {downloading ? "..." : "ZIP"}
              </Button>

              <Button size="sm" className="gap-1 text-xs gradient-bg text-primary-foreground" onClick={handleDeploy} disabled={deployStatus === "deploying"}>
                {ghConnected && <PushToGitHubButton project={project} connected={ghConnected} />}
                {deployStatus === "deploying" ? (
                  <><span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Deploying...</>
                ) : deployStatus === "success" ? (
                  <><CheckCircle className="h-3 w-3" /> Live ✅</>
                ) : deployStatus === "error" ? (
                  <><XCircle className="h-3 w-3" /> Retry</>
                ) : (
                  <><Rocket className="h-3 w-3" /> Deploy</>
                )}
              </Button>
            </div>
          </div>

          {currentDeployUrl && (
            <a href={currentDeployUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
              <ExternalLink className="h-3 w-3" /> {currentDeployUrl}
            </a>
          )}
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="preview" className="gap-1 text-xs"><Eye className="h-3 w-3" /> Preview</TabsTrigger>
            <TabsTrigger value="code" className="gap-1 text-xs"><Code className="h-3 w-3" /> Code</TabsTrigger>
          </TabsList>

          {/* Page switcher for multi-page */}
          {isMultipage && (
            <div className="flex items-center gap-1 mt-3 mb-1 overflow-x-auto">
              {pages.map((page, idx) => (
                <button
                  key={page.name}
                  onClick={() => setActivePage(idx)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
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

          <TabsContent value="preview" className="mt-4">
            <div className="bg-secondary/30 rounded-lg overflow-hidden min-h-[350px]">
              <iframe srcDoc={previewHtml} className="w-full h-[400px] border-0 rounded-lg bg-white" sandbox="allow-same-origin" title="Project Preview" />
            </div>
          </TabsContent>
          <TabsContent value="code" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={codeTab === "html" ? "default" : "outline"} className="text-xs" onClick={() => setCodeTab("html")}>
                HTML / CSS
              </Button>
              {!isMultipage && (
                <Button size="sm" variant={codeTab === "react" ? "default" : "outline"} className="text-xs" onClick={() => setCodeTab("react")}>
                  React
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-xs ml-auto gap-1" onClick={() => {
                const code = codeTab === "html"
                  ? `${currentPage?.html || ""}\n\n/* CSS */\n${project.css || ""}`
                  : project.react_code || "";
                navigator.clipboard.writeText(code);
                toast({ title: "Code copied!" });
              }}>
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
            <pre className="bg-secondary/30 rounded-lg p-4 text-xs text-muted-foreground overflow-auto font-mono max-h-[350px]">
              {codeTab === "html"
                ? `<!-- HTML${isMultipage ? ` — ${currentPage?.title}` : ""} -->\n${currentPage?.html || "No HTML generated"}\n\n/* CSS */\n${project.css || "No CSS generated"}`
                : project.react_code || "No React code generated"}
            </pre>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
