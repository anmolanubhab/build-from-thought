// path: supabase/functions/preview-start/index.ts
// Preview Runtime (Phase 3 continued): boots a REAL, live Next.js dev server for a
// generated project inside an isolated E2B sandbox (a Firecracker microVM), and
// returns a public preview URL the Editor can embed in an iframe.
//
// This replaces the static HTML approximation with the actual generated app running
// exactly as it would after deployment (real React state, Server/Client Components,
// API Routes, Server Actions, middleware, Supabase queries, App Router behavior —
// everything a static `srcDoc` HTML render cannot execute).
//
// Provider-agnostic by design: this file is the ONLY place that talks to the E2B SDK.
// The DB schema (preview_sessions.provider) and the frontend service layer
// (src/services/preview.ts) are written against a generic "preview session" shape, so
// a future runtime swap (Vercel Sandbox, Daytona, a self-hosted Docker/Firecracker
// pool, ...) only touches this function's internals, never the Editor UI.
//
// Pipeline: acquire an idempotent per-project lock -> create/reuse a sandbox -> write
// project files (plus a dev-only overlay: relaxed Next.js dev-origin check + injected
// env vars) -> npm install -> start `next dev` in the background -> poll until it
// answers on :3000 -> expose the port as a public URL -> persist status "running".
//
// Security: the E2B API key never leaves this server-side function. Generated code
// never executes in the main WebdevsAI process — it only ever runs inside E2B's
// isolated microVM, which has no access to WebdevsAI's own filesystem, credentials,
// or other projects' sandboxes (each project gets its own sandbox instance).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Sandbox } from "https://esm.sh/e2b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_DIR = "/home/user/project";
const DEV_PORT = 3000;
// code-interpreter-v1 is E2B's own flagship template and includes a Node.js runtime
// (it's the base for their JS/TS code-execution product). Once a custom
// WebdevsAI-specific template is built from e2b/nextjs-template/ (pre-baking Next.js +
// the fixed scaffold deps so `npm install` only needs to fetch the few extra
// AI-requested packages), point E2B_TEMPLATE_ID at it for faster cold starts — this
// function picks that up automatically without any code change.
const DEFAULT_TEMPLATE = "code-interpreter-v1";
const SESSION_TIMEOUT_MS = 50 * 60 * 1000; // stay safely under E2B Hobby's 60-min session cap
const READY_POLL_INTERVAL_MS = 1500;
const READY_POLL_MAX_ATTEMPTS = 40; // ~60s total
const LOG_TAIL_MAX_CHARS = 8000;
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tail(text: string, max = LOG_TAIL_MAX_CHARS): string {
  return text.length > max ? text.slice(-max) : text;
}

function friendlyError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw);
  const lower = text.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key")) {
    return "The preview service isn't configured correctly (invalid E2B API key). Contact support.";
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "Too many preview sessions right now. Please wait a moment and try again.";
  }
  if (lower.includes("concurrent") || lower.includes("limit")) {
    return "The preview service is at capacity right now. Please try again shortly.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The preview took too long to start (install or server startup was slow). Try again — this is usually transient.";
  }
  const trimmed = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  return `Couldn't start the live preview (${trimmed}). Please try again.`;
}

async function markError(admin: ReturnType<typeof createClient>, projectId: string, message: string, logTail?: string): Promise<void> {
  const { error } = await admin.from("preview_sessions").update({
    status: "error",
    error_message: message,
    log_tail: logTail !== undefined ? tail(logTail) : undefined,
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq("project_id", projectId);
  if (error) console.error("Failed to mark preview_sessions row as error:", error.message);
}

function pickSession(row: any): any {
  if (!row) return null;
  return {
    status: row.status,
    preview_url: row.preview_url,
    error_message: row.error_message,
    log_tail: row.log_tail,
    port: row.port,
  };
}

/** Dev-only overlay merged on top of the project's real files inside the sandbox only
 * (never written back to project.files / the database). Two concerns:
 *  1. Next.js 15+ blocks cross-origin dev-server asset requests by default; the
 *     preview is served from an *.e2b.app / *.e2b.dev host, not localhost, so it must
 *     be explicitly allow-listed or Fast Refresh's own asset requests get rejected.
 *  2. Inject the project's real Supabase URL/anon key (if a database has been
 *     provisioned) so the live preview behaves exactly like the deployed app instead
 *     of falling back to mock data.
 */
function buildDevOverlay(files: Record<string, string>, envVars: Record<string, string>): Record<string, string> {
  const overlay: Record<string, string> = {};

  const existingConfig = files["next.config.ts"] || "";
  const allowedOriginsSnippet = `["*.e2b.app", "*.e2b.dev"]`;
  if (/allowedDevOrigins/.test(existingConfig)) {
    overlay["next.config.ts"] = existingConfig.replace(/allowedDevOrigins:\s*\[[^\]]*\]/, `allowedDevOrigins: ${allowedOriginsSnippet}`);
  } else {
    overlay["next.config.ts"] = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Injected by WebdevsAI's live preview runtime only — not part of the saved
  // project. Next.js blocks cross-origin dev-server requests by default; the
  // preview is served from an E2B sandbox host rather than localhost.
  allowedDevOrigins: ${allowedOriginsSnippet},
};

export default nextConfig;
`;
  }

  if (Object.keys(envVars).length > 0) {
    const existingEnv = files[".env.local"] || "";
    const extra = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join("\n");
    overlay[".env.local"] = existingEnv ? `${existingEnv}\n${extra}\n` : `${extra}\n`;
  }

  return overlay;
}

async function waitForServer(sbx: Sandbox, port: number): Promise<boolean> {
  for (let attempt = 0; attempt < READY_POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await sbx.commands.run(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`, {
        cwd: PROJECT_DIR,
        timeoutMs: 5000,
      });
      const code = (res?.stdout || "").trim();
      if (code && code !== "000" && Number(code) < 500) return true;
    } catch {
      // Not up yet — expected during install/compile. Keep polling.
    }
    await sleep(READY_POLL_INTERVAL_MS);
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { project_id, version_id } = await req.json();
    if (!project_id || typeof project_id !== "string") return json({ error: "project_id is required" }, 400);

    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY) {
      return json({ error: "Live preview isn't configured yet — the E2B_API_KEY secret is missing. Ask an admin to add it in Supabase → Edge Functions → Secrets." }, 500);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: project, error: projectError } = await admin.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (projectError || !project) return json({ error: "Project not found" }, 404);

    // The Editor's open changes live in project_versions (status "draft") until
    // Publish — projects.files only reflects the last PUBLISHED version. When the
    // frontend passes the open draft's id (see src/services/preview.ts), the preview
    // must run whatever's actually being edited right now, not the stale published
    // copy, or "live reload after AI edits" would silently show the wrong app.
    let files: Record<string, string> | null = null;
    if (version_id && typeof version_id === "string") {
      const { data: version, error: versionError } = await admin
        .from("project_versions").select("files").eq("id", version_id).eq("project_id", project_id).maybeSingle();
      if (versionError) throw versionError;
      if (version?.files && typeof version.files === "object" && !Array.isArray(version.files) && Object.keys(version.files as Record<string, unknown>).length > 0) {
        files = version.files as Record<string, string>;
      }
    }
    if (!files) {
      if (!project.files || typeof project.files !== "object" || Array.isArray(project.files) || Object.keys(project.files).length === 0) {
        return json({ error: "Live preview is only available for modern (Next.js) projects." }, 400);
      }
      files = project.files as Record<string, string>;
    }

    // --- Idempotency: reuse an already-running sandbox instead of creating a new
    // one on every "open editor" / re-render. Only short-circuits if the sandbox is
    // verified alive right now — a stale "running" row (e.g. sandbox hit its own
    // timeout) falls through to a fresh start instead of returning a dead URL. ---
    const { data: existing } = await admin.from("preview_sessions").select("*").eq("project_id", project_id).maybeSingle();
    if (existing?.status === "running" && existing.sandbox_id) {
      try {
        const alive = await Sandbox.connect(existing.sandbox_id, { apiKey: E2B_API_KEY });
        await alive.commands.run("true", { timeoutMs: 5000 });
        await admin.from("preview_sessions").update({ last_active_at: new Date().toISOString() }).eq("project_id", project_id);
        return json({ status: "running", session: pickSession(existing) });
      } catch {
        // Sandbox is gone/dead — fall through and start a fresh one below.
      }
    }
    if (existing?.status === "starting" || existing?.status === "installing" || existing?.status === "starting_server") {
      // Another start request is already in flight (or crashed without cleaning up).
      // Only take over if its lock looks stale (no update in the last 3 minutes).
      const lockedAt = existing.locked_at ? new Date(existing.locked_at).getTime() : 0;
      if (Date.now() - lockedAt < 3 * 60 * 1000) {
        return json({ status: existing.status, session: pickSession(existing) });
      }
    }

    const nowIso = new Date().toISOString();
    if (!existing) {
      const { error: insertErr } = await admin.from("preview_sessions").insert({
        project_id, provider: "e2b", status: "starting", port: DEV_PORT,
        error_message: null, locked_at: nowIso, updated_at: nowIso,
      });
      if (insertErr) {
        if (insertErr.code === "23505") {
          const { data: raced } = await admin.from("preview_sessions").select("*").eq("project_id", project_id).maybeSingle();
          return json({ status: raced?.status ?? "starting", session: pickSession(raced) });
        }
        throw insertErr;
      }
    } else {
      const { data: updated, error: updateErr } = await admin.from("preview_sessions")
        .update({ status: "starting", error_message: null, sandbox_id: null, preview_url: null, locked_at: nowIso, updated_at: nowIso })
        .eq("project_id", project_id).select();
      if (updateErr) throw updateErr;
      if (!updated || updated.length === 0) {
        const { data: raced } = await admin.from("preview_sessions").select("*").eq("project_id", project_id).maybeSingle();
        return json({ status: raced?.status ?? "starting", session: pickSession(raced) });
      }
    }

    // --- We hold the lock. Provision the sandbox. ---
    let sbx: Sandbox;
    try {
      sbx = await Sandbox.create(Deno.env.get("E2B_TEMPLATE_ID") || DEFAULT_TEMPLATE, {
        apiKey: E2B_API_KEY,
        timeoutMs: SESSION_TIMEOUT_MS,
      });
    } catch (createErr) {
      const message = friendlyError(createErr);
      await markError(admin, project_id, message);
      return json({ error: message }, 502);
    }

    await admin.from("preview_sessions").update({
      sandbox_id: sbx.sandboxId,
      status: "installing",
      expires_at: new Date(Date.now() + SESSION_TIMEOUT_MS).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("project_id", project_id);

    let envVars: Record<string, string> = {};
    const { data: db } = await admin.from("project_databases").select("project_url, anon_key, status").eq("project_id", project_id).maybeSingle();
    if (db?.status === "ready" && db.project_url && db.anon_key) {
      envVars = { NEXT_PUBLIC_SUPABASE_URL: db.project_url, NEXT_PUBLIC_SUPABASE_ANON_KEY: db.anon_key };
    }

    const overlay = buildDevOverlay(files, envVars);
    const merged = { ...files, ...overlay };
    let logBuffer = "";

    try {
      await sbx.commands.run(`mkdir -p ${PROJECT_DIR}`, { timeoutMs: 10000 });
      await sbx.files.write(
        Object.entries(merged).map(([path, content]) => ({ path: `${PROJECT_DIR}/${path}`, data: content })),
      );
    } catch (writeErr) {
      const message = friendlyError(writeErr);
      try { await sbx.kill(); } catch { /* best-effort cleanup */ }
      await markError(admin, project_id, message);
      return json({ error: message }, 502);
    }

    try {
      const installResult = await sbx.commands.run("npm install --no-audit --no-fund", {
        cwd: PROJECT_DIR,
        timeoutMs: INSTALL_TIMEOUT_MS,
        onStdout: (d: string) => { logBuffer += d; },
        onStderr: (d: string) => { logBuffer += d; },
      });
      if (installResult?.exitCode && installResult.exitCode !== 0) {
        throw new Error(`npm install failed (exit ${installResult.exitCode})`);
      }
    } catch (installErr) {
      const message = friendlyError(installErr);
      try { await sbx.kill(); } catch { /* best-effort cleanup */ }
      await markError(admin, project_id, message, logBuffer);
      return json({ error: message, logs: tail(logBuffer) }, 502);
    }

    await admin.from("preview_sessions").update({
      status: "starting_server",
      log_tail: tail(logBuffer),
      updated_at: new Date().toISOString(),
    }).eq("project_id", project_id);

    try {
      // Piped through `tee` into a log file so later, separate edge-function
      // invocations (preview-status, preview-sweep) can read fresh server output by
      // reconnecting to this sandbox and tailing the file — a background command's
      // onStdout/onStderr callbacks only live as long as THIS invocation does.
      await sbx.commands.run(`sh -c "npx next dev -p ${DEV_PORT} -H 0.0.0.0 2>&1 | tee -a /tmp/dev.log"`, {
        cwd: PROJECT_DIR,
        background: true,
        onStdout: (d: string) => { logBuffer += d; },
        onStderr: (d: string) => { logBuffer += d; },
      });
    } catch (startErr) {
      const message = friendlyError(startErr);
      try { await sbx.kill(); } catch { /* best-effort cleanup */ }
      await markError(admin, project_id, message, logBuffer);
      return json({ error: message, logs: tail(logBuffer) }, 502);
    }

    const ready = await waitForServer(sbx, DEV_PORT);
    if (!ready) {
      const message = "The dev server didn't respond in time — check the logs for a compile error.";
      try { await sbx.kill(); } catch { /* best-effort cleanup */ }
      await markError(admin, project_id, message, logBuffer);
      return json({ error: message, logs: tail(logBuffer) }, 502);
    }

    let previewUrl: string;
    try {
      const host = sbx.getHost(DEV_PORT);
      previewUrl = `https://${host}`;
    } catch (hostErr) {
      const message = friendlyError(hostErr);
      try { await sbx.kill(); } catch { /* best-effort cleanup */ }
      await markError(admin, project_id, message, logBuffer);
      return json({ error: message }, 502);
    }

    const finishedIso = new Date().toISOString();
    await admin.from("preview_sessions").update({
      status: "running",
      preview_url: previewUrl,
      log_tail: tail(logBuffer),
      error_message: null,
      last_active_at: finishedIso,
      locked_at: null,
      updated_at: finishedIso,
    }).eq("project_id", project_id);

    return json({ status: "running", session: { status: "running", preview_url: previewUrl, port: DEV_PORT, log_tail: tail(logBuffer) } });
  } catch (e) {
    console.error("preview-start error:", e);
    return json({ error: friendlyError(e) }, 500);
  }
});
