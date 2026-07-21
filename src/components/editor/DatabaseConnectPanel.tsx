// path: src/components/editor/DatabaseConnectPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Loader2, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronUp, Zap, Server } from "lucide-react";
import {
  provisionDatabase, checkDatabaseProvisioning, getProjectDatabase,
  type ProjectDatabase, type ProvisionResult, type DatabaseStatus, type DatabaseMode,
} from "@/services/database";

interface Props {
  projectId: string;
  /** Whether the AI's plan for this project flagged that it needs persisted data. */
  needsDatabase: boolean;
  /** Called once provisioning finishes successfully, with the merged file map to apply into the editor. */
  onProvisioned: (files: Record<string, string>, summary: string) => void;
}

type Phase = "idle" | "choosing" | "working" | "ready" | "error";

// Granular progress labels shown while provisioning is in flight. Because the actual
// provisioning work happens server-side in one edge function call (shared mode) or a
// create-then-poll flow (dedicated mode), we don't get a live stream of server-side
// steps — so this rotates through the real, ordered stages the backend performs
// (see provision-database/index.ts's finishProvisioning) at a pace that roughly tracks
// how long each stage actually tends to take, purely as a progress indicator. It is not
// a claim that the server just reported that exact stage.
const SHARED_STAGES = [
  "Connecting to Supabase...",
  "Applying schema...",
  "Creating policies...",
  "Generating client...",
  "Updating project...",
];
const DEDICATED_STAGES = [
  "Connecting to Supabase...",
  "Creating project...",
  "Waiting for provisioning...",
  "Applying schema...",
  "Creating policies...",
  "Generating client...",
  "Updating project...",
];
const STAGE_INTERVAL_MS = 2200;

export default function DatabaseConnectPanel({ projectId, needsDatabase, onProvisioned }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [db, setDb] = useState<ProjectDatabase | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [lastMode, setLastMode] = useState<DatabaseMode | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stages = (db?.mode ?? lastMode) === "dedicated" ? DEDICATED_STAGES : SHARED_STAGES;

  // Takes the mode explicitly (rather than reading the `stages` closure) so it's always
  // correct even when called from the very first render, before `db`/`lastMode` state
  // has committed — e.g. resuming into an already-"provisioning" row on page load.
  const startStageRotation = (mode: DatabaseMode | null) => {
    const seq = mode === "dedicated" ? DEDICATED_STAGES : SHARED_STAGES;
    setStageIndex(0);
    if (stageRef.current) clearInterval(stageRef.current);
    stageRef.current = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, seq.length - 1));
    }, STAGE_INTERVAL_MS);
  };

  const stopStageRotation = () => {
    if (stageRef.current) {
      clearInterval(stageRef.current);
      stageRef.current = null;
    }
  };

  useEffect(() => () => stopStageRotation(), []);

  useEffect(() => {
    let cancelled = false;
    getProjectDatabase(projectId)
      .then((row) => {
        if (cancelled || !row) return;
        setDb(row);
        if (row.status === "ready") setPhase("ready");
        else if (row.status === "provisioning") {
          setLastMode(row.mode);
          setPhase("working");
          startStageRotation(row.mode);
          startPolling();
        } else if (row.status === "error") {
          setLastMode(row.mode);
          setPhase("error");
          setErrorMessage(row.error_message);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startPolling = () => {
    const poll = async () => {
      try {
        const result = await checkDatabaseProvisioning(projectId);
        handleResult(result);
        if (result.status === "provisioning") {
          pollRef.current = setTimeout(poll, 4000);
        }
      } catch (err) {
        stopStageRotation();
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to check provisioning status");
      }
    };
    pollRef.current = setTimeout(poll, 4000);
  };

  const handleResult = (result: ProvisionResult) => {
    setDb(result.database);
    setLastMode(result.database.mode);
    if (result.status === "ready") {
      stopStageRotation();
      // Show the final "Provision complete." label for a beat before switching to the
      // "ready" summary view, so the progress sequence doesn't cut off abruptly.
      setStageIndex(-1);
      if (result.files) {
        const summary = result.data_layer_rewired
          ? "Connected a real Supabase database and wired the app to it."
          : "Connected a real Supabase database (schema applied — the code may still need a manual data-layer wire-up).";
        onProvisioned(result.files, summary);
      }
      setTimeout(() => setPhase("ready"), 600);
    } else if (result.status === "provisioning") {
      setPhase("working");
    }
  };

  const handleChoose = async (mode: DatabaseMode) => {
    setPhase("working");
    setErrorMessage(null);
    setNotConnected(false);
    setLastMode(mode);
    startStageRotation(mode);
    try {
      const result = await provisionDatabase(projectId, mode);
      handleResult(result);
      if (result.status === "provisioning") startPolling();
    } catch (err) {
      stopStageRotation();
      const message = err instanceof Error ? err.message : "Failed to start provisioning";
      if (message.includes("NOT_CONNECTED") || message.toLowerCase().includes("connect your supabase account")) {
        setNotConnected(true);
      }
      setPhase("error");
      setErrorMessage(message);
    }
  };

  // Nothing to show: plan doesn't need a database and nothing has ever been provisioned.
  if (!needsDatabase && !db) return null;

  if (phase === "ready" && db) {
    return (
      <div className="border-b border-gray-200 bg-white">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700">Database connected</span>
          <span className="text-[10px] text-gray-400">
            ({db.mode === "shared" ? "shared project" : "dedicated project"})
          </span>
          <div className="flex-1" />
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </button>
        {expanded && (
          <div className="px-3 pb-3 space-y-1.5">
            {db.project_url && (
              <a href={`https://supabase.com/dashboard/project/${db.project_ref}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                Open in Supabase <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {db.tables.length > 0 && (
              <p className="text-[11px] text-gray-500">
                Tables: <span className="font-mono">{db.tables.join(", ")}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === "working") {
    const label = stageIndex === -1 ? "Provision complete." : stages[Math.min(stageIndex, stages.length - 1)];
    return (
      <div className="border-b border-gray-200 bg-violet-50/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {stageIndex === -1 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin flex-shrink-0" />
          )}
          <span className="text-xs text-violet-700">{label}</span>
        </div>
        {stageIndex !== -1 && (
          <div className="mt-1.5 flex gap-1 pl-5">
            {stages.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= stageIndex ? "bg-violet-400" : "bg-violet-100"}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-amber-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-xs font-medium text-amber-900">This app needs a database</span>
        <div className="flex-1" />
        {phase !== "choosing" && (
          <button
            onClick={() => setPhase("choosing")}
            className="text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-md transition-colors"
          >
            Connect Database
          </button>
        )}
      </div>

      {phase === "error" && errorMessage && (
        <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          <div>
            {errorMessage}
            {notConnected && (
              <>
                {" "}
                <Link to="/dashboard/resources?connectors" className="underline font-medium">Connect Supabase in Settings →</Link>
              </>
            )}
          </div>
          {!notConnected && lastMode && (
            <button
              onClick={() => handleChoose(lastMode)}
              className="mt-1.5 text-[11px] font-semibold text-red-700 hover:text-red-800 underline underline-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {phase === "choosing" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => handleChoose("shared")}
            className="flex flex-col items-start gap-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 p-2.5 text-left transition-colors"
          >
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-900"><Zap className="h-3 w-3 text-amber-600" /> Existing Project</span>
            <span className="text-[10px] text-gray-500">Fast — reuses your connected Supabase project. Ready instantly.</span>
          </button>
          <button
            onClick={() => handleChoose("dedicated")}
            className="flex flex-col items-start gap-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 p-2.5 text-left transition-colors"
          >
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-900"><Server className="h-3 w-3 text-amber-600" /> New Dedicated Project</span>
            <span className="text-[10px] text-gray-500">Production — its own isolated Supabase project. Takes ~1-2 min.</span>
          </button>
        </div>
      )}
    </div>
  );
}
