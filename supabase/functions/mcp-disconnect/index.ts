// path: supabase/functions/mcp-disconnect/index.ts
// Soft-deletes a connection (status = 'disconnected') and deletes its Vault
// secret, if any. Owner-only. Never hard-deletes the row, so history in
// mcp_logs stays intact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deleteVaultSecret } from "../_shared/mcp/vault.ts";

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
      .select("workspace_id, vault_secret_id")
      .eq("id", connection_id)
      .maybeSingle();
    if (!connection) return json({ error: "Connection not found" }, 404);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", connection.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || membership.role !== "owner") {
      return json({ error: "Only the workspace owner can disconnect MCP servers" }, 403);
    }

    if (connection.vault_secret_id) await deleteVaultSecret(admin, connection.vault_secret_id).catch(() => {});

    const { error: updateError } = await admin
      .from("mcp_connections")
      .update({ status: "disconnected", vault_secret_id: null, updated_at: new Date().toISOString() })
      .eq("id", connection_id);
    if (updateError) return json({ error: updateError.message }, 500);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
