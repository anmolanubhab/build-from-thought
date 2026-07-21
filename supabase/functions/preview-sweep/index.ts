// path: supabase/functions/preview-sweep/index.ts
// Resource management: called every 5 minutes by a pg_cron job (see migration
// enable_pg_cron_and_preview_sweep) via pg_net — NOT by an end user, so it has no
// Supabase auth JWT to verify. Authenticated instead with a shared secret header,
// which is why this function must be deployed with verify_jwt disabled.
//
// Two jobs:
//  1. Stop sandboxes nobody has polled in a while (the frontend polls preview-status
//     roughly every 15-20s while the Live tab is open, so a stale last_active_at
//     means the tab was closed/navigated away — see "Automatically stop inactive
//     preview sessions" / "Destroy idle sandboxes safely" in the spec).
//  2. Fail out sessions stuck mid-provisioning for too long (a crashed invocation
//     that never got to mark its own row "running" or "error" — same "never left
//     stuck forever" convention used for database provisioning).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Sandbox } from "https://esm.sh/e2b";

const IDLE_STOP_MINUTES = 10;
const STUCK_PROVISIONING_MINUTES = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function killBestEffort(sandboxId: string | null, apiKey: string | undefined) {
  if (!sandboxId || !apiKey) return;
  try {
    const sbx = await Sandbox.connect(sandboxId, { apiKey });
    await sbx.kill();
  } catch {
    // Already gone — nothing to clean up.
  }
}

serve(async (req) => {
  try {
    const expected = Deno.env.get("PREVIEW_SWEEP_SECRET");
    const provided = req.headers.get("X-Sweep-Secret");
    if (!expected || provided !== expected) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");

    const idleThreshold = new Date(Date.now() - IDLE_STOP_MINUTES * 60 * 1000).toISOString();
    const { data: idle } = await admin.from("preview_sessions").select("project_id, sandbox_id").eq("status", "running").lt("last_active_at", idleThreshold);

    let stopped = 0;
    for (const row of idle ?? []) {
      await killBestEffort(row.sandbox_id, E2B_API_KEY);
      await admin.from("preview_sessions").update({
        status: "stopped", sandbox_id: null, preview_url: null,
        error_message: "Stopped automatically after a period of inactivity.",
        updated_at: new Date().toISOString(),
      }).eq("project_id", row.project_id);
      stopped++;
    }

    const stuckThreshold = new Date(Date.now() - STUCK_PROVISIONING_MINUTES * 60 * 1000).toISOString();
    const { data: stuck } = await admin.from("preview_sessions")
      .select("project_id, sandbox_id")
      .in("status", ["starting", "installing", "starting_server"])
      .lt("updated_at", stuckThreshold);

    let failed = 0;
    for (const row of stuck ?? []) {
      await killBestEffort(row.sandbox_id, E2B_API_KEY);
      await admin.from("preview_sessions").update({
        status: "error", sandbox_id: null, preview_url: null, locked_at: null,
        error_message: "Preview setup timed out. Please try starting the preview again.",
        updated_at: new Date().toISOString(),
      }).eq("project_id", row.project_id);
      failed++;
    }

    return json({ ok: true, stopped_idle: stopped, failed_stuck: failed });
  } catch (e) {
    console.error("preview-sweep error:", e);
    return json({ error: e instanceof Error ? e.message : "Sweep failed" }, 500);
  }
});
