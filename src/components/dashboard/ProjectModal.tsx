// path: src/components/dashboard/ProjectModal.tsx
import { useState, useEffect } from "react";
import { Project, getProjectPages } from "@/lib/projects";
import { downloadProject } from "@/services/export";
import { deployProject, DeployStatus } from "@/services/deploy";
import { updateProject } from "@/services/db";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, Code, Download, Rocket, Copy, ExternalLink, Share2, CheckCircle, XCircle, Files,
  ChevronDown, Globe, Monitor, Tablet, Smartphone, Loader2, Lock,
} from "lucide-react";
import { PushToGitHubButton } from "@/components/dashboard/GitHubButton";
import DeployToVercelDialog from "@/components/dashboard/DeployToVercelDialog";
import DomainManagerDialog from "@/components/dashboard/DomainManagerDialog";
import DeployToNetlifyDialog from "@/components/dashboard/DeployToNetlifyDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  landing: "Landing Page",
  generic: "Web App",
};

export type Device = "desktop" | "tablet" | "mobile";

const devices: { id: Device; icon: typeof Monitor; width: string; label: string }[] = [
  { id: "desktop", icon: Monitor, width: "100%", label: "Desktop" },
  { id: "tablet", icon: Tablet, width: "768px", label: "Tablet" },
  { id: "mobile", icon: Smartphone, width: "390px", label: "Mobile" },
];

interface Props {
  project: Project | null;
  onClose: () => void;
  onUpdate?: (project: Project) => void;
  ghConnected?: boolean;
  /** Tab to open on — e.g. ProjectActionMenu's "Export" opens straight to code. Defaults to "preview". */
  initialTab?: "preview" | "code";
  /** Device frame to open on — e.g. ProjectActionMenu's "Preview Mobile". Defaults to "desktop". */
  initialDevice?: Device;
}

export default function ProjectModal({ project, onClose, onUpdate, ghConnected, initialTab, initialDevice }: Props) {
  const [tab, setTab] = useState<"preview" | "code">(initialTab ?? "preview");
  const [device, setDevice] = useState<Device>(initialDevice ?? "desktop");

  // Re-seed the initial tab/device every time a (new) project opens, since
  // this modal instance is reused across opens rather than remounted.
  useEffect(() => {
    if (project) {
      setTab(initialTab ?? "preview");
      setDevice(initialDevice ?? "desktop");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  const [codeTab, setCodeTab] = useState<"html" | "react">("html");
  const [downloading, setDownloading] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [vercelDialogOpen, setVercelDialogOpen] = useState(false);
  const [domainsDialogOpen, setDomainsDialogOpen] = useState(false);
  const [netlifyDialogOpen, setNetlifyDialogOpen] = useState(false);
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

  const copyDeployUrl = () => {
    if (!currentDeployUrl) return;
    navigator.clipboard.writeText(currentDeployUrl);
    toast({ title: "URL copied!" });
  };

  const previewHtml = `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  ${project.css || ""}
</style></head><body>${currentPage?.html || "<div style='padding:2rem;color:#94a3b8;'>No preview available</div>"}</body></html>`;

  return (
    <>
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] max-w-[1400px] h-[88vh] max-h-[88vh] p-0 gap-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-2 pr-12 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <DialogTitle className="text-gray-900 font-semibold truncate text-base">{project.title}</DialogTitle>
            <Badge variant="outline" className="text-[10px] shrink-0 border-gray-200 text-gray-500 bg-gray-50">
              {typeLabels[project.type]}
            </Badge>
            {isMultipage && (
              <Badge variant="outline" className="text-[10px] shrink-0 gap-1 border-gray-200 text-gray-500 bg-gray-50">
                <Files className="h-2.5 w-2.5" /> {pages.length} pages
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-gray-200">
              <Switch
                id="public-toggle"
                checked={project.is_public}
                onCheckedChange={handleTogglePublic}
                className="data-[state=checked]:bg-blue-600"
              />
              <label htmlFor="public-toggle" className="text-xs text-gray-500 select-none cursor-pointer">
                {project.is_public ? "Public" : "Private"}
              </label>
            </div>

            {project.is_public && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50" onClick={copyShareLink}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            )}

            {ghConnected && <PushToGitHubButton project={project} connected={ghConnected} />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  disabled={deployStatus === "deploying"}
                >
                  {deployStatus === "deploying" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Rocket className="h-3.5 w-3.5" />
                  )}
                  Deploy
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-700 w-56">
                <DropdownMenuItem onClick={handleDeploy} className="gap-2 text-xs focus:bg-gray-50 cursor-pointer">
                  {deployStatus === "success" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : deployStatus === "error" ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Rocket className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  Quick Deploy
                  <span className="ml-auto text-[10px] text-gray-400">Instant</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVercelDialogOpen(true)} className="gap-2 text-xs focus:bg-gray-50 cursor-pointer">
                  <Rocket className="h-3.5 w-3.5 text-gray-400" /> Deploy to Vercel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNetlifyDialogOpen(true)} className="gap-2 text-xs focus:bg-gray-50 cursor-pointer">
                  <Rocket className="h-3.5 w-3.5 text-gray-400" /> Deploy to Netlify
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="gap-2 text-xs focus:bg-gray-50 cursor-pointer">
                  <Download className="h-3.5 w-3.5 text-gray-400" /> {downloading ? "Zipping…" : "Download ZIP"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDomainsDialogOpen(true)} className="gap-2 text-xs focus:bg-gray-50 cursor-pointer">
                  <Globe className="h-3.5 w-3.5 text-gray-400" /> Manage Domains
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Compact deploy URL bar */}
        {currentDeployUrl && (
          <div className="flex items-center gap-2 px-5 py-1 border-b border-gray-100 bg-blue-50/40 shrink-0">
            <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-mono text-gray-600" title={currentDeployUrl}>
              {currentDeployUrl}
            </span>
            <button
              onClick={copyDeployUrl}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-white transition-colors shrink-0"
              aria-label="Copy URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href={currentDeployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-white transition-colors shrink-0"
              aria-label="Open URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Workspace */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "preview" | "code")} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 px-5 py-1 border-b border-gray-100 shrink-0">
            <TabsList className="bg-gray-100 p-1 h-8">
              <TabsTrigger value="preview" className="gap-1.5 text-xs text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
                <Eye className="h-3.5 w-3.5" /> Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1.5 text-xs text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
                <Code className="h-3.5 w-3.5" /> Code
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {isMultipage && (
                <Select value={String(currentPageIndex)} onValueChange={(v) => setActivePage(Number(v))}>
                  <SelectTrigger className="h-8 w-40 text-xs bg-white border-gray-200 text-gray-700">
                    <SelectValue placeholder="Page" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 text-gray-700">
                    {pages.map((page, idx) => (
                      <SelectItem key={page.name} value={String(idx)} className="text-xs focus:bg-gray-50">
                        {page.title || page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {tab === "preview" && (
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-1">
                  {devices.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setDevice(id)}
                      aria-label={label}
                      title={label}
                      className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                        device === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <TabsContent value="preview" className="flex-1 min-h-0 m-0 p-2 bg-gray-50/70 overflow-auto">
            <div className="h-full flex justify-center">
              <div
                className="h-full max-w-full flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                style={{ width: devices.find((d) => d.id === device)?.width }}
              >
                <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                  <div className="flex-1 mx-2 flex items-center gap-1.5 rounded-md bg-white border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-400 truncate">
                    <Lock className="h-2.5 w-2.5 text-gray-300 shrink-0" />
                    {currentPage?.title || "Preview"}
                  </div>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  className="flex-1 w-full border-0 bg-white"
                  sandbox="allow-same-origin"
                  title="Project Preview"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="code" className="flex-1 min-h-0 m-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 shrink-0">
                <Button size="sm" variant={codeTab === "html" ? "default" : "outline"} className={cn("text-xs h-7", codeTab === "html" ? "bg-blue-600 hover:bg-blue-700" : "border-gray-200 text-gray-600")} onClick={() => setCodeTab("html")}>
                  HTML / CSS
                </Button>
                {!isMultipage && (
                  <Button size="sm" variant={codeTab === "react" ? "default" : "outline"} className={cn("text-xs h-7", codeTab === "react" ? "bg-blue-600 hover:bg-blue-700" : "border-gray-200 text-gray-600")} onClick={() => setCodeTab("react")}>
                    React
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 ml-auto gap-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => {
                    const code = codeTab === "html"
                      ? `${currentPage?.html || ""}\n\n/* CSS */\n${project.css || ""}`
                      : project.react_code || "";
                    navigator.clipboard.writeText(code);
                    toast({ title: "Code copied!" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <pre className="flex-1 overflow-auto m-0 px-5 py-4 text-xs text-gray-600 font-mono bg-gray-50/60">
                {codeTab === "html"
                  ? `<!-- HTML${isMultipage ? ` — ${currentPage?.title}` : ""} -->\n${currentPage?.html || "No HTML generated"}\n\n/* CSS */\n${project.css || "No CSS generated"}`
                  : project.react_code || "No React code generated"}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <DeployToVercelDialog open={vercelDialogOpen} onClose={() => setVercelDialogOpen(false)} project={project} />
    <DomainManagerDialog open={domainsDialogOpen} onClose={() => setDomainsDialogOpen(false)} project={project} />
    <DeployToNetlifyDialog open={netlifyDialogOpen} onClose={() => setNetlifyDialogOpen(false)} project={project} />
    </>
  );
}
