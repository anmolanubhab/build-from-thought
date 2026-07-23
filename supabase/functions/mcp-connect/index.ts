// path: supabase/functions/mcp-connect/index.ts
// Creates (or, given connection_id, reconnects/replaces the secret of) a
// workspace's connection to an MCP server. Owner-only. Verifies the server
// is actually reachable (a real `initialize` call) before saving anything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mcpInitialize } from "../_shared/mcp/transport.ts";
import { createVaultSecret, deleteVaultSecret } from "../_shared/mcp/vault.ts";
import { MCP_PRESETS, resolvePresetEndpointUrl } from "../_shared/mcp/presets.ts";

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

    const body = await req.json();
    const { workspace_id, server_slug, custom_url, name, token, connection_id } = body ?? {};
    if (!workspace_id) return json({ error: "workspace_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || membership.role !== "owner") {
      return json({ error: "Only the workspace owner can connect MCP servers" }, 403);
    }

    // Resolve preset vs. custom into { serverId, endpointUrlTemplate, resolvedUrl, authKind, reuseGithubToken }.
    let serverId: string | null = null;
    let endpointUrlToStore: string;
    let resolvedUrl: string;
    let authKind: "bearer" | "url_key" | "reuse_github_token" | "none";
    let connectionName = name?.trim();
    let githubAccessToken: string | null = null;

    if (server_slug) {
      const preset = MCP_PRESETS[server_slug];
      if (!preset) return json({ error: `Unknown server preset: ${server_slug}` }, 400);
      const { data: serverRow } = await admin.from("mcp_servers").select("id, name, is_active").eq("slug", server_slug).maybeSingle();
      if (!serverRow || !serverRow.is_active) return json({ error: "That server preset isn't available" }, 400);
      serverId = serverRow.id;
      authKind = preset.authKind;
      connectionName = connectionName || serverRow.name;

      if (preset.authKind === "url_key") {
        if (!token?.trim()) return json({ error: `${preset.slug} requires an API key` }, 400);
        endpointUrlToStore = preset.endpointTemplate; // template only — key never persisted in this column
        resolvedUrl = resolvePresetEndpointUrl(preset, token.trim());
      } else if (preset.authKind === "bearer") {
        if (!token?.trim()) return json({ error: `${preset.slug} requires an API key` }, 400);
        endpointUrlToStore = preset.endpointTemplate;
        resolvedUrl = preset.endpointTemplate;
      } else {
        // reuse_github_token
        const { data: ghToken } = await admin.from("github_tokens").select("access_token").eq("user_id", userId).maybeSingle();
        if (!ghToken) return json({ error: "Connect your GitHub account first (Settings → Git)" }, 400);
        githubAccessToken = ghToken.access_token;
        endpointUrlToStore = preset.endpointTemplate;
        resolvedUrl = preset.endpointTemplate;
      }
    } else {
      if (!custom_url?.trim() || !/^https:\/\//.test(custom_url.trim())) {
        return json({ error: "Enter a valid https:// MCP server URL" }, 400);
      }
      endpointUrlToStore = custom_url.trim();
      resolvedUrl = custom_url.trim();
      authKind = token?.trim() ? "bearer" : "none";
      connectionName = connectionName || new URL(custom_url.trim()).hostname;
    }

    // Verify reachability with a real initialize call before persisting anything.
    const auth = authKind === "reuse_github_token"
      ? { kind: "bearer" as const, token: githubAccessToken! }
      : authKind === "none"
        ? { kind: "none" as const }
        : { kind: "bearer" as const, token: token!.trim() };

    let capabilities: Record<string, unknown> = {};
    let lastError: string | null = null;
    try {
      const init = await mcpInitialize(resolvedUrl, auth);
      capabilities = init.capabilities;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    // Store the secret (if any) in Vault — never the raw value in a table column.
    let vaultSecretId: string | null = null;
    if (authKind === "bearer" || authKind === "url_key") {
      vaultSecretId = await createVaultSecret(admin, token!.trim(), `mcp_${workspace_id}_${server_slug ?? "custom"}`);
    }

    const status = lastError ? "error" : "connected";
    const nowIso = new Date().toISOString();

    if (connection_id) {
      // Reconnect: replace the secret on an existing connection.
      const { data: existing } = await admin
        .from("mcp_connections")
        .select("workspace_id, vault_secret_id")
        .eq("id", connection_id)
        .maybeSingle();
      if (!existing || existing.workspace_id !== workspace_id) return json({ error: "Connection not found" }, 404);
      if (existing.vault_secret_id) await deleteVaultSecret(admin, existing.vault_secret_id).catch(() => {});

      const { data: updated, error: updateError } = await admin
        .from("mcp_connections")
        .update({
          name: connectionName,
          endpoint_url: endpointUrlToStore,
          vault_secret_id: vaultSecretId,
          reuse_github_token: authKind === "reuse_github_token",
          status,
          last_sync_at: nowIso,
          last_error: lastError,
          capabilities,
          updated_at: nowIso,
        })
        .eq("id", connection_id)
        .select()
        .single();
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ connection: updated });
    }

    const { data: inserted, error: insertError } = await admin
      .from("mcp_connections")
      .insert({
        workspace_id,
        server_id: serverId,
        name: connectionName,
        endpoint_url: endpointUrlToStore,
        vault_secret_id: vaultSecretId,
        reuse_github_token: authKind === "reuse_github_token",
        status,
        last_sync_at: nowIso,
        last_error: lastError,
        capabilities,
        created_by: userId,
      })
      .select()
      .single();
    if (insertError) return json({ error: insertError.message }, 500);

    await admin.from("mcp_permissions").insert([
      { connection_id: inserted.id, workspace_id, role: "owner", can_execute: true },
      { connection_id: inserted.id, workspace_id, role: "editor", can_execute: true },
    ]);

    return json({ connection: inserted });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
