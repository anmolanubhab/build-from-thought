// path: supabase/functions/mcp-execute/index.ts
// Thin HTTP wrapper around _shared/mcp/execute.ts's executeToolAndLog — the
// same internal function mcp-chat's tool-planner loop calls directly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeToolAndLog, ExecuteError } from "../_shared/mcp/execute.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const { connection_id, tool_name, args, workspace_id } = await req.json();
    if (!connection_id || !tool_name || !workspace_id) {
      return json({ error: "connection_id, tool_name, and workspace_id are required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this workspace" }, 403);

    const result = await executeToolAndLog(admin, {
      connectionId: connection_id,
      toolName: tool_name,
      args: args ?? {},
      workspaceId: workspace_id,
      invokedBy: userId,
      role: membership.role as "owner" | "editor",
    });

    return json({ result });
  } catch (err) {
    if (err instanceof ExecuteError) return json({ error: err.message }, err.status);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
