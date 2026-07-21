// path: src/components/editor/LivePreview.tsx
// Real, live Next.js preview (Phase 3: Real Preview Environment) — replaces the
// static srcDoc approximation for modern (files-based) projects. Boots a real
// `next dev` server inside an isolated E2B sandbox via the preview-* edge
// functions and embeds its live URL in an iframe, so React state, Server/Client
// Components, API Routes, Server Actions, middleware, and real Supabase queries
// all actually run — not just an HTML/CSS guess at what they'd render.
//
// State machine mirrors preview_sessions.status: starting -> installing ->
// starting_server -> running (or error / stopped at any point). Polls fast while
// provisioning, then slowly once running (both to catch a sandbox that died and
// to keep last_active_at fresh for preview-sweep's idle cleanup).

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, RotateCw, Sparkles, Square, Terminal, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPreviewStatus, restartPreview, startPreview, stopPreview, syncPreview,
  type PreviewStatus,
} from "@/services/preview";

const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 20000; // also doubles as the "someone is watching" signal for preview-sweep

interface LivePreviewProps {
  projectId: string;
  versionId?: string | null;
  /** Current file map — used only to detect that an edit happened (compared by reference/JSON, not diffed) so we know to push a hot sync. */
  files: Record<string, string> | null;
  /** Called when the user clicks "Fix Errors". Should apply an AI fix and resolve true on success. */
  onFixErrors?: (errorMessage: string, logTail: string) => Promise<boolean>;
}

const STATUS_LABEL: Record<PreviewStatus, string> = {
  idle: "Not started",
  starting: "Starting sandbox…",
  installing: "Installing dependencies…",
  starting_server: "Starting server…",
  running: "Preview ready",
  error: "Build failed",
  stopped: "Preview stopped",
};

export default function LivePreview({ projectId, versionId, files, onFixErrors }: LivePreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logTail, setLogTail] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFilesRef = useRef<Record<string, string> | null>(null);
  const startedRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applySession = useCallback((s: { status: PreviewStatus; preview_url?: string | null; error_message?: string | null; log_tail?: string | null } | undefined, fallbackStatus: PreviewStatus) => {
    const st = s?.status ?? fallbackStatus;
    setStatus(st);
    if (s?.preview_url !== undefined) setPreviewUrl(s.preview_url ?? null);
    if (s?.error_message !== undefined) setErrorMessage(s.error_message ?? null);
    if (s?.log_tail !== undefined) setLogTail(s.log_tail ?? "");
    return st;
  }, []);

  const schedulePoll = useCallback((delay: number) => {
    clearPoll();
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await getPreviewStatus(projectId);
        const st = applySession(result.session, result.status);
        if (st === "starting" || st === "installing" || st === "starting_server") {
          schedulePoll(FAST_POLL_MS);
        } else if (st === "running") {
          schedulePoll(SLOW_POLL_MS);
        }
        // error / stopped / idle: stop polling until the user acts.
      } catch {
        // Transient network hiccup — try again shortly rather than giving up.
        schedulePoll(FAST_POLL_MS);
      }
    }, delay);
  }, [applySession, clearPoll, projectId]);

  const boot = useCallback(async () => {
    setBusy(true);
    try {
      const result = await startPreview(projectId, versionId);
      const st = applySession(result.session, result.status);
      if (result.error) setErrorMessage(result.error);
      if (result.logs) setLogTail(result.logs);
      if (st === "starting" || st === "installing" || st === "starting_server") {
        schedulePoll(FAST_POLL_MS);
      } else if (st === "running") {
        schedulePoll(SLOW_POLL_MS);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start the live preview");
    } finally {
      setBusy(false);
    }
  }, [applySession, projectId, schedulePoll, versionId]);

  // Boot once per project.
  useEffect(() => {
    startedRef.current = false;
    setStatus("idle");
    setPreviewUrl(null);
    setErrorMessage(null);
    setLogTail("");
    lastFilesRef.current = files;
    clearPoll();
    if (!startedRef.current) {
      startedRef.current = true;
      boot();
    }
    return () => clearPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Hot sync: push changed files into the already-running sandbox whenever the
  // file map changes (AI edit applied, undo, accepted preview change, ...).
  useEffect(() => {
    if (lastFilesRef.current === files) return;
    lastFilesRef.current = files;
    if (!files || status === "idle") return;
    if (status !== "running" && status !== "error") return; // mid-provisioning already has the latest files

    (async () => {
      try {
        const result = await syncPreview(projectId, versionId);
        if (result.status === "idle") {
          // No live sandbox to push into (it died between polls) — start fresh.
          boot();
          return;
        }
        if (result.error) {
          setStatus("error");
          setErrorMessage(result.error);
          if (result.logs) setLogTail(result.logs);
          return;
        }
        // Fast Refresh applies the change on its own — just refresh our status/log view.
        const fresh = await getPreviewStatus(projectId);
        applySession(fresh.session, fresh.status);
        if (fresh.status === "running") schedulePoll(SLOW_POLL_MS);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to sync the latest changes into the preview");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleRestart = useCallback(async () => {
    setBusy(true);
    clearPoll();
    setStatus("starting");
    setErrorMessage(null);
    try {
      const result = await restartPreview(projectId, versionId);
      const st = applySession(result.session, result.status);
      if (result.error) setErrorMessage(result.error);
      if (st === "starting" || st === "installing" || st === "starting_server") schedulePoll(FAST_POLL_MS);
      else if (st === "running") schedulePoll(SLOW_POLL_MS);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to restart the live preview");
    } finally {
      setBusy(false);
    }
  }, [applySession, clearPoll, projectId, schedulePoll, versionId]);

  const handleStop = useCallback(async () => {
    setBusy(true);
    clearPoll();
    try {
      await stopPreview(projectId);
      setStatus("stopped");
      setPreviewUrl(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to stop the live preview");
    } finally {
      setBusy(false);
    }
  }, [clearPoll, projectId]);

  const handleRefresh = useCallback(() => setIframeKey((k) => k + 1), []);

  const handleFixErrors = useCallback(async () => {
    if (!onFixErrors) return;
    setFixing(true);
    try {
      const applied = await onFixErrors(errorMessage || "Unknown build error", logTail);
      if (applied) await handleRestart();
    } finally {
      setFixing(false);
    }
  }, [errorMessage, logTail, onFixErrors, handleRestart]);

  const isProvisioning = status === "starting" || status === "installing" || status === "starting_server";

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-9 px-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full flex-shrink-0",
            status === "running" ? "bg-green-500" :
            status === "error" ? "bg-red-500" :
            status === "stopped" || status === "idle" ? "bg-gray-300" : "bg-amber-400 animate-pulse"
          )}
        />
        <span className="text-xs font-medium text-gray-600 truncate">{STATUS_LABEL[status]}</span>
        <div className="flex-1" />

        <button
          onClick={handleRefresh}
          disabled={status !== "running" || busy}
          title="Refresh"
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleRestart}
          disabled={busy || isProvisioning}
          title="Restart preview (rebuild)"
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleStop}
          disabled={busy || status === "stopped" || status === "idle"}
          title="Stop preview"
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
          disabled={!previewUrl}
          title="Open in new tab"
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowLogs((v) => !v)}
          title="View logs"
          className={cn(
            "p-1.5 rounded-md transition-colors",
            showLogs ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          )}
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gray-100">
        {status === "running" && previewUrl && (
          <iframe
            key={iframeKey}
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            title="Live preview"
          />
        )}

        {isProvisioning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95">
            <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            <p className="text-sm font-medium text-gray-600">{STATUS_LABEL[status]}</p>
            <p className="text-xs text-gray-400 max-w-xs text-center">
              Booting an isolated sandbox and running your real Next.js app — this usually takes 20-40s.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-6">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="text-sm font-semibold text-gray-900 text-center">Preview failed to build</p>
            <p className="text-xs text-gray-500 max-w-md text-center whitespace-pre-wrap">{errorMessage}</p>
            <div className="flex items-center gap-2 mt-1">
              {onFixErrors && (
                <button
                  onClick={handleFixErrors}
                  disabled={fixing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Fix and Retry
                </button>
              )}
              <button
                onClick={handleRestart}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        )}

        {status === "stopped" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
            <p className="text-sm font-medium text-gray-500">Preview stopped</p>
            <button
              onClick={handleRestart}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
            >
              <Wifi className="h-3.5 w-3.5" /> Reconnect
            </button>
          </div>
        )}

        {showLogs && (
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gray-950 border-t border-gray-800 flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Live logs</span>
              <button onClick={() => setShowLogs(false)} className="text-[10px] text-gray-500 hover:text-gray-300">Close</button>
            </div>
            <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono leading-relaxed text-gray-300 whitespace-pre-wrap">
              {logTail || "No logs yet."}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
