// path: src/components/dashboard/DeployToVercelDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Project } from "@/lib/projects";
import { detectEnvVars } from "@/lib/envDetection";
import {
  deployToVercel, fetchVercelDeploymentStatus, fetchDeploymentHistory,
  rollbackToDeployment, explainBuildError,
  type DeploymentRecord, type BuildErrorExplanation,
} from "@/services/vercelDeploy";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Sparkles, RotateCcw, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

type Phase = "form" | "building" | "success" | "failed";
type Tab = "deploy" | "history";

export default function DeployToVercelDialog({ open, onClose, project }: Props) {
  const [tab, setTab] = useState<Tab>("deploy");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [history, setHistory] = useState<DeploymentRecord[]>([]);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<BuildErrorExplanation | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const refreshHistory = () => {
    if (project) fetchDeploymentHistory(project.id).then(setHistory).catch(() => {});
  };

  useEffect(() => {
    if (open && project) {
      const detected = detectEnvVars(project);
      setEnvVars(Object.fromEntries(detected.map((k) => [k, ""])));
      setTab("deploy");
      setPhase("form");
      setDeployUrl(null);
      setErrorMessage(null);
      setLogs([]);
      setExplanation(null);
      refreshHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

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
          refreshHistory();
        } else if (result.status === "failed" || result.status === "canceled") {
          setPhase("failed");
          setErrorMessage(result.error_message || "Deployment failed");
          const withLogs = await fetchVercelDeploymentStatus(deploymentId, true);
          if (!cancelled) setLogs(withLogs.logs);
          refreshHistory();
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
    setExplanation(null);
    try {
      const result = await deployToVercel(project.id, envVars);
      setDeploymentId(result.deployment_id);
      setDeployUrl(result.url);
    } catch (err) {
      setPhase("failed");
      setErrorMessage(err instanceof Error ? err.message : "Deploy failed");
    }
  };

  const handleExplain = async () => {
    setExplaining(true);
    try {
      const result = await explainBuildError(errorMessage, logs);
      setExplanation(result);
    } catch (err) {
      toast({
        title: "Couldn't get AI explanation",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setExplaining(false);
    }
  };

  const handleRollback = async (deployment: DeploymentRecord) => {
    setRollingBackId(deployment.id);
    try {
      await rollbackToDeployment(deployment.id);
      toast({ title: "Rolled back", description: "Production now points to this deployment." });
      refreshHistory();
    } catch (err) {
      toast({
        title: "Rollback failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRollingBackId(null);
    }
  };

  const handleRedeploy = (deployment: DeploymentRecord) => {
    const keys = deployment.env_var_keys || [];
    setEnvVars(Object.fromEntries(keys.map((k) => [k, ""])));
    setTab("deploy");
    setPhase("form");
  };

  const handleClose = () => onClose();

  if (!project) return null;

  const statusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Deploy "{project.title}" to Vercel</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b mb-1">
          <button
            onClick={() => setTab("deploy")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "deploy" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            Deploy
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "history" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {tab === "deploy" && phase === "form" && (
          <div className="space-y-3 py-2 max-h-72 overflow-auto">
            <p className="text-xs text-muted-foreground">
              {Object.keys(envVars).length > 0
                ? "We found these environment variables referenced in your code — fill in the values Vercel should use."
                : "No environment variables detected in this project's code."}
            </p>
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
          </div>
        )}

        {tab === "deploy" && phase === "building" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
            <p className="text-sm font-medium">Deploying to Vercel...</p>
            <p className="text-xs text-muted-foreground">This usually takes 10-30 seconds.</p>
          </div>
        )}

        {tab === "deploy" && phase === "success" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold">Deployed successfully!</p>
            {deployUrl && (
              <a href={deployUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline">
                {deployUrl} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {tab === "deploy" && phase === "failed" && (
          <div className="py-4 space-y-3 max-h-96 overflow-auto">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold text-sm">Deployment failed</p>
            </div>
            {errorMessage && (
              <p className="text-sm bg-red-500/10 border border-red-500/30 rounded-md p-2.5 font-mono">{errorMessage}</p>
            )}

            {!explanation && (
              <Button size="sm" variant="outline" onClick={handleExplain} disabled={explaining} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {explaining ? "Analyzing..." : "Explain with AI"}
              </Button>
            )}

            {explanation && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600"><Sparkles className="h-3 w-3" /> AI explanation</p>
                <p className="text-sm">{explanation.explanation}</p>
                {explanation.suggested_command && (
                  <div className="bg-black/90 rounded-md p-2 mt-1">
                    <code className="text-[11px] font-mono text-emerald-400">{explanation.suggested_command}</code>
                  </div>
                )}
              </div>
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

        {tab === "history" && (
          <div className="space-y-2 py-2 max-h-80 overflow-auto">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No deployments yet.</p>
            )}
            {history.map((d) => (
              <div key={d.id} className="rounded-lg border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    {statusIcon(d.status)}
                    {d.provider === "vercel" ? "Vercel" : "Quick deploy"}
                    <span className="text-muted-foreground font-normal">· {new Date(d.created_at).toLocaleString()}</span>
                  </span>
                </div>
                {d.error_message && (
                  <p className="text-[11px] text-red-500 font-mono truncate">{d.error_message}</p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  {d.deploy_url && d.status === "success" && (
                    <a href={d.deploy_url} target="_blank" rel="noreferrer" className="text-[11px] text-violet-600 hover:underline inline-flex items-center gap-0.5">
                      Visit <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {d.provider === "vercel" && d.status === "success" && (
                    <button
                      onClick={() => handleRollback(d)}
                      disabled={rollingBackId === d.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> {rollingBackId === d.id ? "Rolling back..." : "Rollback to this"}
                    </button>
                  )}
                  <button
                    onClick={() => handleRedeploy(d)}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Redeploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tab === "deploy" && (phase === "success" || phase === "failed") ? "Close" : "Cancel"}
          </Button>
          {tab === "deploy" && phase === "form" && <Button onClick={handleDeploy}>Deploy</Button>}
          {tab === "deploy" && phase === "failed" && <Button onClick={() => setPhase("form")}>Try Again</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
