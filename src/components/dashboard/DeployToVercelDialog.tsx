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
import { analyzeDeployment, applyAiFixes, type LighthouseScores, type AiSuggestion } from "@/services/aiReview";
import { createDraft } from "@/services/versions";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Sparkles, RotateCcw, RefreshCw, Gauge } from "lucide-react";

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
  const [analyzing, setAnalyzing] = useState(false);
  const [scores, setScores] = useState<LighthouseScores | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [applyingFixes, setApplyingFixes] = useState(false);

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
      setScores(null);
      setSuggestions([]);
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

  const handleAnalyze = async () => {
    if (!deploymentId) return;
    setAnalyzing(true);
    try {
      const result = await analyzeDeployment(deploymentId);
      setScores(result.scores);
      setSuggestions(result.suggestions);
    } catch (err) {
      toast({
        title: "Couldn't analyze deployment",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyAll = async () => {
    if (!project || suggestions.length === 0) return;
    setApplyingFixes(true);
    try {
      const result = await applyAiFixes(
        project.id,
        { html: project.html || "", css: project.css || "", react_code: project.react_code || "" },
        suggestions
      );
      await createDraft(
        project.id,
        { html: result.html, css: result.css, react_code: result.react_code, pages: project.pages },
        result.summary
      );
      toast({ title: "Draft created", description: "Open the project in the Editor to preview and publish these fixes." });
    } catch (err) {
      toast({
        title: "Couldn't apply fixes",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setApplyingFixes(false);
    }
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
      <DialogContent className="sm:max-w-lg bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Deploy "{project.title}" to Vercel</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-gray-200 mb-1">
          <button
            onClick={() => setTab("deploy")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "deploy" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-400"}`}
          >
            Deploy
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "history" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-400"}`}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {tab === "deploy" && phase === "form" && (
          <div className="space-y-3 py-2 max-h-72 overflow-auto">
            <p className="text-xs text-gray-500">
              {Object.keys(envVars).length > 0
                ? "We found these environment variables referenced in your code — fill in the values Vercel should use."
                : "No environment variables detected in this project's code."}
            </p>
            {Object.keys(envVars).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`env-${key}`} className="font-mono text-xs text-gray-700">{key}</Label>
                <Input
                  id={`env-${key}`}
                  value={envVars[key]}
                  onChange={(e) => setEnvVars((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Value (optional)"
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30"
                />
              </div>
            ))}
          </div>
        )}

        {tab === "deploy" && phase === "building" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-medium text-gray-900">Deploying to Vercel...</p>
            <p className="text-xs text-gray-500">This usually takes 10-30 seconds.</p>
          </div>
        )}

        {tab === "deploy" && phase === "success" && (
          <div className="py-4 space-y-4 max-h-96 overflow-auto">
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-gray-900">Deployed successfully!</p>
              {deployUrl && (
                <a href={deployUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  {deployUrl} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {!scores && (
              <div className="text-center">
                <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5 border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Gauge className="h-3.5 w-3.5" /> {analyzing ? "Analyzing (Lighthouse)..." : "Run AI Deployment Review"}
                </Button>
              </div>
            )}

            {scores && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([
                    ["Performance", scores.performance],
                    ["SEO", scores.seo],
                    ["Accessibility", scores.accessibility],
                    ["Best Practices", scores.best_practices],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 p-2">
                      <p className={`text-lg font-bold ${value >= 90 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-red-600"}`}>{value}</p>
                      <p className="text-[10px] text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>

                {suggestions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">Suggestions</p>
                    {suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-gray-50 border border-gray-100 p-2">
                        <Sparkles className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{s.title}</p>
                          <p className="text-gray-500">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" onClick={handleApplyAll} disabled={applyingFixes} className="w-full gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
                      <Sparkles className="h-3.5 w-3.5" /> {applyingFixes ? "Applying fixes..." : "Apply All (creates a draft)"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center">No major issues found — nice work!</p>
                )}
              </div>
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
              <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-2.5 font-mono">{errorMessage}</p>
            )}

            {!explanation && (
              <Button size="sm" variant="outline" onClick={handleExplain} disabled={explaining} className="gap-1.5 border-gray-200 text-gray-600 hover:bg-gray-50">
                <Sparkles className="h-3.5 w-3.5" /> {explaining ? "Analyzing..." : "Explain with AI"}
              </Button>
            )}

            {explanation && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600"><Sparkles className="h-3 w-3" /> AI explanation</p>
                <p className="text-sm text-gray-700">{explanation.explanation}</p>
                {explanation.suggested_command && (
                  <div className="bg-gray-900 rounded-md p-2 mt-1">
                    <code className="text-[11px] font-mono text-emerald-400">{explanation.suggested_command}</code>
                  </div>
                )}
              </div>
            )}

            {logs.length > 0 && (
              <div className="bg-gray-900 rounded-md p-2.5 max-h-40 overflow-auto">
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
              <p className="text-sm text-gray-400 py-6 text-center">No deployments yet.</p>
            )}
            {history.map((d) => (
              <div key={d.id} className="rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-gray-900">
                    {statusIcon(d.status)}
                    {d.provider === "vercel" ? "Vercel" : "Quick deploy"}
                    <span className="text-gray-400 font-normal">· {new Date(d.created_at).toLocaleString()}</span>
                  </span>
                </div>
                {d.error_message && (
                  <p className="text-[11px] text-red-500 font-mono truncate">{d.error_message}</p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  {d.deploy_url && d.status === "success" && (
                    <a href={d.deploy_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5">
                      Visit <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {d.provider === "vercel" && d.status === "success" && (
                    <button
                      onClick={() => handleRollback(d)}
                      disabled={rollingBackId === d.id}
                      className="text-[11px] text-gray-400 hover:text-gray-700 inline-flex items-center gap-0.5"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> {rollingBackId === d.id ? "Rolling back..." : "Rollback to this"}
                    </button>
                  )}
                  <button
                    onClick={() => handleRedeploy(d)}
                    className="text-[11px] text-gray-400 hover:text-gray-700 inline-flex items-center gap-0.5"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Redeploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="border-gray-200 text-gray-600 hover:bg-gray-50">
            {tab === "deploy" && (phase === "success" || phase === "failed") ? "Close" : "Cancel"}
          </Button>
          {tab === "deploy" && phase === "form" && <Button onClick={handleDeploy} className="bg-blue-600 text-white hover:bg-blue-700">Deploy</Button>}
          {tab === "deploy" && phase === "failed" && <Button onClick={() => setPhase("form")} className="bg-blue-600 text-white hover:bg-blue-700">Try Again</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
