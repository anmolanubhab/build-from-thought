// path: supabase/functions/preview-sync/index.ts
// Hot file push: after an AI edit, writes ONLY the changed files into the ALREADY
// RUNNING sandbox's filesystem instead of tearing it down and starting over. Next.js's
// own dev-server file watcher (Fast Refresh) picks up the change and the embedded
// preview iframe updates itself — no restart, no manual reload, matching the "Hot
// Reload / Fast Refresh / automatic rebuild / automatic browser refresh" requirement.
//
// Falls back to a no-op (frontend then calls preview-start fresh) when there's no
// live sandbox to sync into. Re-runs `npm install` (without restarting the dev
// process — Next.js dev picks up newly-installed packages on the next compile) when
// package.json is among the changed files, since a new dependency won't be in
// node_modules yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Sandbox } from "https://esm.sh/e2b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_DIR = "/home/user/project";
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
const LOG_TAIL_MAX_CHARS = 8000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function tail(text: string, max = LOG_TAIL_MAX_CHARS): string {
  return text.length > max ? text.slice(-max) : text;
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

    const { project_id, version_id, changed_paths } = await req.json();
    if (!project_id || typeof project_id !== "string") return json({ error: "project_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: project, error: projectError } = await admin.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (projectError || !project) return json({ error: "Project not found" }, 404);

    // Same reasoning as preview-start: sync from the open draft's files when the
    // frontend has one (this is what "hot reload after an AI edit" actually pushes),
    // falling back to the published projects.files otherwise.
    let files: Record<string, string> | null = null;
    if (version_id && typeof version_id === "string") {
      const { data: version } = await admin
        .from("project_versions").select("files").eq("id", version_id).eq("project_id", project_id).maybeSingle();
      if (version?.files && typeof version.files === "object" && !Array.isArray(version.files) && Object.keys(version.files as Record<string, unknown>).length > 0) {
        files = version.files as Record<string, string>;
      }
    }
    if (!files) {
      if (!project.files || typeof project.files !== "object" || Array.isArray(project.files)) {
        return json({ status: "idle" });
      }
      files = project.files as Record<string, string>;
    }

    const { data: sess } = await admin.from("preview_sessions").select("*").eq("project_id", project_id).maybeSingle();
    if (!sess || sess.status !== "running" || !sess.sandbox_id) {
      // No live sandbox to push into — the next preview-start will pick up the
      // current files from scratch, so there's nothing to do here.
      return json({ status: "idle" });
    }

    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY) return json({ status: "idle" });

    let sbx: Sandbox;
    try {
      sbx = await Sandbox.connect(sess.sandbox_id, { apiKey: E2B_API_KEY });
    } catch {
      // Sandbox died between polls — mark it stopped so the next preview-start
      // creates a fresh one instead of silently doing nothing.
      await admin.from("preview_sessions").update({
        status: "stopped",
        error_message: "The preview session ended before this edit could be synced.",
        updated_at: new Date().toISOString(),
      }).eq("project_id", project_id);
      return json({ status: "stopped" });
    }

    const paths: string[] = Array.isArray(changed_paths) && changed_paths.length > 0
      ? changed_paths.filter((p: unknown) => typeof p === "string" && files[p as string] !== undefined)
      : Object.keys(files); // no explicit change list — sync everything, safe default

    if (paths.length === 0) return json({ status: "running" });

    try {
      await sbx.files.write(paths.map((p) => ({ path: `${PROJECT_DIR}/${p}`, data: files[p] })));
    } catch (writeErr) {
      return json({ error: writeErr instanceof Error ? writeErr.message : "Failed to sync files into the preview" }, 502);
    }

    const needsInstall = paths.includes("package.json");
    let logBuffer = "";
    if (needsInstall) {
      await admin.from("preview_sessions").update({ status: "installing", updated_at: new Date().toISOString() }).eq("project_id", project_id);
      try {
        await sbx.commands.run("npm install --no-audit --no-fund", {
          cwd: PROJECT_DIR,
          timeoutMs: INSTALL_TIMEOUT_MS,
          onStdout: (d: string) => { logBuffer += d; },
          onStderr: (d: string) => { logBuffer += d; },
        });
      } catch (installErr) {
        const message = installErr instanceof Error ? installErr.message : "Failed to install the newly added dependency";
        await admin.from("preview_sessions").update({
          status: "error", error_message: message, log_tail: tail(logBuffer), updated_at: new Date().toISOString(),
        }).eq("project_id", project_id);
        return json({ error: message, logs: tail(logBuffer) }, 502);
      }
      await admin.from("preview_sessions").update({
        status: "running", log_tail: tail(logBuffer), last_active_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("project_id", project_id);
    } else {
      await admin.from("preview_sessions").update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("project_id", project_id);
    }

    return json({ status: "running", synced: paths.length, installed: needsInstall });
  } catch (e) {
    console.error("preview-sync error:", e);
    return json({ error: e instanceof Error ? e.message : "Failed to sync preview" }, 500);
  }
});
