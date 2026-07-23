// path: supabase/functions/_shared/mcp/vault.ts
// Thin wrappers around the mcp_vault_* Postgres functions (see the Phase 1
// migration) — the only way to create/read/delete an MCP connection's
// secret. Those functions have EXECUTE revoked from anon/authenticated, so
// this only works with a service-role Supabase client.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function createVaultSecret(admin: SupabaseClient, secret: string, name?: string): Promise<string> {
  const { data, error } = await admin.rpc("mcp_vault_create_secret", { p_secret: secret, p_name: name ?? null });
  if (error) throw new Error(`Vault create_secret failed: ${error.message}`);
  return data as string;
}

export async function readVaultSecret(admin: SupabaseClient, id: string): Promise<string> {
  const { data, error } = await admin.rpc("mcp_vault_read_secret", { p_id: id });
  if (error) throw new Error(`Vault read_secret failed: ${error.message}`);
  if (!data) throw new Error("Vault secret not found");
  return data as string;
}

export async function deleteVaultSecret(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.rpc("mcp_vault_delete_secret", { p_id: id });
  if (error) throw new Error(`Vault delete_secret failed: ${error.message}`);
}
