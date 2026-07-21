// path: supabase/functions/preview-stop/index.ts
// Explicit "Stop Preview" control — the user asked for this sandbox to go away right
// now (rather than waiting for the idle sweep or E2B's own session timeout). Kills the
// sandbox and marks the row "stopped" so a later preview-start creates a fresh one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Sandbox } from "https://esm.sh/e2b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { data: sess } = await admin.from("preview_sessions").select("sandbox_id").eq("project_id", project_id).maybeSingle();
    if (sess?.sandbox_id) {
      const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
      if (E2B_API_KEY) {
        try {
          const sbx = await Sandbox.connect(sess.sandbox_id, { apiKey: E2B_API_KEY });
          await sbx.kill();
        } catch {
          // Already dead or unreachable — fine, we're marking it stopped either way.
        }
      }
    }

    await admin.from("preview_sessions").update({
      status: "stopped",
      sandbox_id: null,
      preview_url: null,
      error_message: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq("project_id", project_id);

    return json({ status: "stopped" });
  } catch (e) {
    console.error("preview-stop error:", e);
    return json({ error: e instanceof Error ? e.message : "Failed to stop preview" }, 500);
  }
});
