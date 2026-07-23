// path: supabase/functions/mcp-refresh-tools/index.ts
// Calls tools/list on a connection's MCP server and upserts the result into
// mcp_tools. Any workspace member may trigger a refresh (read-only from the
// workspace's point of view); tools no longer returned are marked stale
// rather than deleted, so a transient failure can't silently blank the list.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mcpInitialize, mcpListTools } from "../_shared/mcp/transport.ts";
import { resolveConnectionAuth } from "../_shared/mcp/resolve.ts";

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

    const { connection_id } = await req.json();
    if (!connection_id) return json({ error: "connection_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: connection } = await admin
      .from("mcp_connections")
      .select("id, workspace_id, endpoint_url, vault_secret_id, reuse_github_token, server_id, created_by, status")
      .eq("id", connection_id)
      .maybeSingle();
    if (!connection) return json({ error: "Connection not found" }, 404);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", connection.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this workspace" }, 403);

    if (connection.status === "disconnected") return json({ error: "This connection is disconnected" }, 400);

    const nowIso = new Date().toISOString();
    try {
      const { url, auth } = await resolveConnectionAuth(admin, connection);
      await mcpInitialize(url, auth);
      const tools = await mcpListTools(url, auth);

      await admin.from("mcp_tools").update({ is_stale: true }).eq("connection_id", connection_id);

      for (const tool of tools) {
        await admin.from("mcp_tools").upsert(
          {
            connection_id,
            name: tool.name,
            description: tool.description ?? null,
            input_schema: tool.inputSchema ?? {},
            is_stale: false,
            updated_at: nowIso,
          },
          { onConflict: "connection_id,name" },
        );
      }

      await admin.from("mcp_connections").update({ status: "connected", last_sync_at: nowIso, last_error: null, updated_at: nowIso }).eq("id", connection_id);
      return json({ tools });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh tools";
      await admin.from("mcp_connections").update({ status: "error", last_error: message, updated_at: nowIso }).eq("id", connection_id);
      return json({ error: message }, 502);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
