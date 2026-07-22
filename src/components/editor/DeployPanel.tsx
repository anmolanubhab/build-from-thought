// path: src/components/editor/DeployPanel.tsx
import { useEffect, useState } from "react";
import {
  Rocket, Download, Globe, Loader2, CheckCircle, XCircle, Copy, ExternalLink, Share2, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Project } from "@/lib/projects";
import { downloadProject } from "@/services/export";
import { deployProject, DeployStatus } from "@/services/deploy";
import { updateProject } from "@/services/db";
import { getGitHubStatus } from "@/services/github";
import { ConnectGitHubButton, PushToGitHubButton } from "@/components/dashboard/GitHubButton";
import DeployToVercelDialog from "@/components/dashboard/DeployToVercelDialog";
import DeployToNetlifyDialog from "@/components/dashboard/DeployToNetlifyDialog";
import DomainManagerDialog from "@/components/dashboard/DomainManagerDialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

export default function DeployPanel({ project, onUpdate }: Props) {
  const [ghConnected, setGhConnected] = useState(false);
  const [ghUsername, setGhUsername] = useState<string | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [vercelOpen, setVercelOpen] = useState(false);
  const [netlifyOpen, setNetlifyOpen] = useState(false);
  const [domainsOpen, setDomainsOpen] = useState(false);

  const refreshGitHubStatus = () => {
    getGitHubStatus().then((s) => { setGhConnected(s.connected); setGhUsername(s.username); }).catch(() => {});
  };

  useEffect(() => { refreshGitHubStatus(); }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadProject(project);
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleQuickDeploy = async () => {
    setDeployStatus("deploying");
    try {
      const url = await deployProject(project);
      const updated = await updateProject(project.id, { deployed_url: url });
      onUpdate(updated);
      setDeployStatus("success");
      toast({ title: "Deployed!", description: "Your project is now live." });
    } catch (err) {
      setDeployStatus("error");
      toast({ title: "Deploy failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const handleTogglePublic = async () => {
    try {
      const updated = await updateProject(project.id, { is_public: !project.is_public });
      onUpdate(updated);
      toast({ title: project.is_public ? "Project is now private" : "Project is now public" });
    } catch (err) {
      toast({ title: "Failed to update", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${project.slug}`);
    toast({ title: "Share link copied!" });
  };

  const copyDeployUrl = () => {
    if (!project.deployed_url) return;
    navigator.clipboard.writeText(project.deployed_url);
    toast({ title: "URL copied!" });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Deploy</h2>
          <p className="text-sm text-gray-500">Ship this project to the web, sync it to GitHub, or grab the source as a ZIP.</p>
        </div>

        {project.deployed_url && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
            <Globe className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-mono text-gray-700">{project.deployed_url}</span>
            <button onClick={copyDeployUrl} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-white transition-colors">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a href={project.deployed_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-white transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Visibility</p>
              <p className="text-xs text-gray-500 mt-0.5">Public projects get a shareable link at /share/{project.slug}.</p>
            </div>
            <div className="flex items-center gap-2">
              {project.is_public ? <Globe className="h-4 w-4 text-blue-500" /> : <Lock className="h-4 w-4 text-gray-400" />}
              <Switch checked={project.is_public} onCheckedChange={handleTogglePublic} />
            </div>
          </div>
          {project.is_public && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={copyShareLink}>
              <Share2 className="h-3.5 w-3.5" /> Copy share link
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-gray-900">Quick deploy</p>
          <Button size="sm" className="gap-1.5" disabled={deployStatus === "deploying"} onClick={handleQuickDeploy}>
            {deployStatus === "deploying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : deployStatus === "success" ? <CheckCircle className="h-3.5 w-3.5" /> : deployStatus === "error" ? <XCircle className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />}
            Deploy now
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-gray-900">Providers</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setVercelOpen(true)}>
              <Rocket className="h-3.5 w-3.5" /> Deploy to Vercel
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setNetlifyOpen(true)}>
              <Rocket className="h-3.5 w-3.5" /> Deploy to Netlify
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setDomainsOpen(true)}>
              <Globe className="h-3.5 w-3.5" /> Manage domains
            </Button>
            {ghConnected ? (
              <PushToGitHubButton project={project} connected={ghConnected} />
            ) : (
              <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHubStatus} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-sm font-medium text-gray-900">Source</p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={downloading} onClick={handleDownload}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download ZIP
          </Button>
        </div>
      </div>

      <DeployToVercelDialog open={vercelOpen} onClose={() => setVercelOpen(false)} project={project} />
      <DeployToNetlifyDialog open={netlifyOpen} onClose={() => setNetlifyOpen(false)} project={project} />
      <DomainManagerDialog open={domainsOpen} onClose={() => setDomainsOpen(false)} project={project} />
    </div>
  );
}
