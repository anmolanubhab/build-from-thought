// path: src/components/dashboard/DeployToNetlifyDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/projects";
import { deployToNetlify, fetchNetlifyDeploymentStatus } from "@/services/netlifyDeploy";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

type Phase = "idle" | "building" | "success" | "failed";

export default function DeployToNetlifyDialog({ open, onClose, project }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setDeployUrl(null);
      setErrorMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (phase !== "building" || !deploymentId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await fetchNetlifyDeploymentStatus(deploymentId);
        if (cancelled) return;
        if (result.status === "success") {
          setPhase("success");
          setDeployUrl(result.url);
        } else if (result.status === "failed") {
          setPhase("failed");
          setErrorMessage(result.error_message || "Deployment failed");
        } else {
          setTimeout(poll, 3000);
        }
      } catch (err) {
        if (!cancelled) {
          setPhase("failed");
          setErrorMessage(err instanceof Error ? err.message : "Failed to check status");
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [phase, deploymentId]);

  const handleDeploy = async () => {
    if (!project) return;
    setPhase("building");
    try {
      const result = await deployToNetlify(project.id);
      setDeploymentId(result.deployment_id);
      setDeployUrl(result.url);
    } catch (err) {
      setPhase("failed");
      setErrorMessage(err instanceof Error ? err.message : "Deploy failed");
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Deploy "{project.title}" to Netlify</DialogTitle>
        </DialogHeader>

        {phase === "idle" && (
          <p className="text-sm text-gray-500 py-4">This creates (or updates) a Netlify site for this project and deploys the current live version.</p>
        )}

        {phase === "building" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-medium text-gray-900">Deploying to Netlify...</p>
          </div>
        )}

        {phase === "success" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold text-gray-900">Deployed successfully!</p>
            {deployUrl && (
              <a href={deployUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                {deployUrl} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {phase === "failed" && (
          <div className="py-4 space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold text-sm">Deployment failed</p>
            </div>
            {errorMessage && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-2.5 font-mono">{errorMessage}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-200 text-gray-600 hover:bg-gray-50">{phase === "success" || phase === "failed" ? "Close" : "Cancel"}</Button>
          {phase === "idle" && <Button onClick={handleDeploy} className="bg-blue-600 text-white hover:bg-blue-700">Deploy</Button>}
          {phase === "failed" && <Button onClick={handleDeploy} className="bg-blue-600 text-white hover:bg-blue-700">Try Again</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
