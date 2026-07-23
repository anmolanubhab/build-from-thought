// path: supabase/functions/_shared/mcp/resolve.ts
// Given an existing mcp_connections row, resolves the real URL to call and
// the auth to use for it — reading the Vault secret or the connection
// owner's GitHub token as needed. Shared by mcp-refresh-tools, mcp-execute,
// and mcp-chat so this logic lives in exactly one place.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readVaultSecret } from "./vault.ts";
import type { McpAuth } from "./transport.ts";

export interface ConnectionRow {
  endpoint_url: string;
  vault_secret_id: string | null;
  reuse_github_token: boolean;
  server_id: string | null;
  created_by: string;
}

export interface ResolvedConnection {
  url: string;
  auth: McpAuth;
}

export async function resolveConnectionAuth(admin: SupabaseClient, connection: ConnectionRow): Promise<ResolvedConnection> {
  if (connection.reuse_github_token) {
    const { data: ghToken } = await admin
      .from("github_tokens")
      .select("access_token")
      .eq("user_id", connection.created_by)
      .maybeSingle();
    if (!ghToken) throw new Error("GitHub account is no longer connected for this connection's owner");
    return { url: connection.endpoint_url, auth: { kind: "bearer", token: ghToken.access_token } };
  }

  let authKind: "bearer" | "url_key" | "none" = connection.vault_secret_id ? "bearer" : "none";
  if (connection.server_id) {
    const { data: server } = await admin.from("mcp_servers").select("auth_kind").eq("id", connection.server_id).maybeSingle();
    if (server?.auth_kind === "url_key" || server?.auth_kind === "bearer") authKind = server.auth_kind;
  }

  if (authKind === "url_key") {
    if (!connection.vault_secret_id) throw new Error("Missing API key for this connection");
    const key = await readVaultSecret(admin, connection.vault_secret_id);
    return { url: connection.endpoint_url.replace("{API_KEY}", encodeURIComponent(key)), auth: { kind: "none" } };
  }

  if (authKind === "bearer" && connection.vault_secret_id) {
    const token = await readVaultSecret(admin, connection.vault_secret_id);
    return { url: connection.endpoint_url, auth: { kind: "bearer", token } };
  }

  return { url: connection.endpoint_url, auth: { kind: "none" } };
}
