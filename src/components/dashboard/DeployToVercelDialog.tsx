// path: src/components/dashboard/DeployToVercelDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/lib/projects";
import { detectEnvVars } from "@/lib/envDetection";
import {
  deployToVercel, fetchVercelDeploymentStatus, fetchDeploymentHistory,
  type DeploymentRecord,
} from "@/services/vercelDeploy";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

type Phase = "form" | "building" | "success" | "failed";

export default function DeployToVercelDialog({ open, onClose, project }: Props) {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [history, setHistory] = useState<DeploymentRecord[]>([]);

  useEffect(() => {
    if (open && project) {
      const detected = detectEnvVars(project);
      setEnvVars(Object.fromEntries(detected.map((k) => [k, ""])));
      setPhase("form");
      setDeployUrl(null);
      setErrorMessage(null);
      setLogs([]);
      fetchDeploymentHistory(project.id).then(setHistory).catch(() => {});
    }
  }, [open, project]);

  // Poll deployment status while building
  useEffect(() => {
    if (phase !== "building" || !deploymentId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await fetchVercelDeploymentStatus(deploymentId, false);
        if (cancelled) return;
        if (result.status === "success") {
          setPhase("success");
          setDeployUrl(result.url);
        } else if (result.status === "failed" || result.status === "canceled") {
          setPhase("failed");
          setErrorMessage(result.error_message || "Deployment failed");
          const withLogs = await fetchVercelDeploymentStatus(deploymentId, true);
          if (!cancelled) setLogs(withLogs.logs);
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
      const result = await deployToVercel(project.id, envVars);
      setDeploymentId(result.deployment_id);
      setDeployUrl(result.url);
    } catch (err) {
      setPhase("failed");
      setErrorMessage(err instanceof Error ? err.message : "Deploy failed");
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Deploy "{project.title}" to Vercel</DialogTitle>
          {phase === "form" && (
            <DialogDescription>
              {Object.keys(envVars).length > 0
                ? "We found these environment variables referenced in your code — fill in the values Vercel should use."
                : "No environment variables detected in this project's code."}
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-3 py-2 max-h-72 overflow-auto">
            {Object.keys(envVars).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`env-${key}`} className="font-mono text-xs">{key}</Label>
                <Input
                  id={`env-${key}`}
                  value={envVars[key]}
                  onChange={(e) => setEnvVars((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Value (optional)"
                />
              </div>
            ))}

            {history.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Recent deployments</p>
                <div className="space-y-1">
                  {history.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
                      <span className="flex items-center gap-1.5">
                        {d.status === "success" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        {d.status === "failed" && <XCircle className="h-3 w-3 text-red-500" />}
                        {d.status === "building" && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                        {d.provider === "vercel" ? "Vercel" : "Quick deploy"} · {new Date(d.created_at).toLocaleString()}
                      </span>
                      {d.deploy_url && d.status === "success" && (
                        <a href={d.deploy_url} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline">Visit</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "building" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
            <p className="text-sm font-medium">Deploying to Vercel...</p>
            <p className="text-xs text-muted-foreground">This usually takes 10-30 seconds.</p>
          </div>
        )}

        {phase === "success" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold">Deployed successfully!</p>
            {deployUrl && (
              <a
                href={deployUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
              >
                {deployUrl} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {phase === "failed" && (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold text-sm">Deployment failed</p>
            </div>
            {errorMessage && (
              <p className="text-sm bg-red-500/10 border border-red-500/30 rounded-md p-2.5 font-mono">{errorMessage}</p>
            )}
            {logs.length > 0 && (
              <div className="bg-black/90 rounded-md p-2.5 max-h-40 overflow-auto">
                {logs.map((line, i) => (
                  <p key={i} className="text-[11px] font-mono text-gray-300 whitespace-pre-wrap">{line}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {phase === "success" || phase === "failed" ? "Close" : "Cancel"}
          </Button>
          {phase === "form" && <Button onClick={handleDeploy}>Deploy</Button>}
          {phase === "failed" && <Button onClick={() => setPhase("form")}>Try Again</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
