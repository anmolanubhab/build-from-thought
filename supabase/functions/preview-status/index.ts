// path: supabase/functions/preview-status/index.ts
// Polls a live preview sandbox: reconnects to it by ID (a background command's log
// callbacks only live as long as the invocation that started them — see
// preview-start's comment on /tmp/dev.log), tails fresh server output, verifies the
// sandbox is still actually alive, and bumps last_active_at so preview-sweep knows
// someone is still watching this preview (see the cron job in the migration
// enable_pg_cron_and_preview_sweep — idle sessions with no recent poll get stopped).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Sandbox } from "https://esm.sh/e2b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_DIR = "/home/user/project";
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

    const { project_id } = await req.json();
    if (!project_id || typeof project_id !== "string") return json({ error: "project_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: project, error: projectError } = await admin.from("projects").select("id").eq("id", project_id).eq("user_id", user.id).single();
    if (projectError || !project) return json({ error: "Project not found" }, 404);

    const { data: sess } = await admin.from("preview_sessions").select("*").eq("project_id", project_id).maybeSingle();
    if (!sess) return json({ status: "idle" });

    // In-flight (starting/installing/starting_server): the caller is polling while
    // preview-start's own invocation is still running the pipeline — just report the
    // last-known status/log_tail, no need to reconnect to a sandbox that may not
    // exist yet.
    if (sess.status !== "running") {
      return json({ status: sess.status, session: { status: sess.status, error_message: sess.error_message, log_tail: sess.log_tail, preview_url: sess.preview_url, port: sess.port } });
    }

    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY || !sess.sandbox_id) {
      return json({ status: "running", session: { status: "running", preview_url: sess.preview_url, log_tail: sess.log_tail, port: sess.port } });
    }

    let freshLog = sess.log_tail || "";
    let alive = true;
    try {
      const sbx = await Sandbox.connect(sess.sandbox_id, { apiKey: E2B_API_KEY });
      const result = await sbx.commands.run("tail -c 8000 /tmp/dev.log 2>/dev/null || true", { cwd: PROJECT_DIR, timeoutMs: 8000 });
      if (result?.stdout) freshLog = tail(result.stdout);
    } catch {
      alive = false;
    }

    const nowIso = new Date().toISOString();
    if (!alive) {
      await admin.from("preview_sessions").update({
        status: "stopped",
        error_message: "The preview session ended (sandbox is no longer reachable — it may have hit its time limit).",
        updated_at: nowIso,
      }).eq("project_id", project_id);
      return json({ status: "stopped", session: { status: "stopped", error_message: "The preview session ended (sandbox is no longer reachable — it may have hit its time limit).", log_tail: freshLog } });
    }

    await admin.from("preview_sessions").update({ log_tail: freshLog, last_active_at: nowIso, updated_at: nowIso }).eq("project_id", project_id);

    return json({ status: "running", session: { status: "running", preview_url: sess.preview_url, log_tail: freshLog, port: sess.port } });
  } catch (e) {
    console.error("preview-status error:", e);
    return json({ error: e instanceof Error ? e.message : "Failed to check preview status" }, 500);
  }
});
