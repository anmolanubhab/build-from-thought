// path: src/services/userSupabase.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * supabase-js's functions.invoke() collapses ANY non-2xx edge function response into a
 * generic `FunctionsHttpError` whose `.message` is just "Edge Function returned a non-2xx
 * status code" — the actual `{ error }` JSON body the function sends back (e.g. "That token
 * was rejected by Supabase...") is only reachable via `error.context` (the raw fetch Response).
 * Same fix as src/services/database.ts's extractFunctionErrorMessage — duplicated here since
 * this module has no shared import path to that one without creating a cross-service dependency.
 */
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      const msg = (body as { message?: unknown; error?: unknown } | null)?.message ?? (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // Response body wasn't JSON (or already consumed) — fall through to the generic message.
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

export interface SupabaseProjectOption {
  ref: string;
  name: string;
  region?: string;
  status?: string;
}

export interface SupabaseConnectionStatus {
  connected: boolean;
  project_ref: string | null;
  project_name: string | null;
}

/** Validates a Personal Access Token and returns the user's Supabase projects. */
export async function connectSupabaseWithToken(personalAccessToken: string): Promise<SupabaseProjectOption[]> {
  const { data, error } = await supabase.functions.invoke("supabase-connect", {
    body: { personal_access_token: personalAccessToken },
  });

  if (error) throw new Error(await extractFunctionErrorMessage(error, "Failed to connect Supabase"));
  if (data?.error) throw new Error(data.error);

  return (data?.projects ?? []) as SupabaseProjectOption[];
}

/** Picks which of the user's Supabase projects this workspace should use. */
export async function selectSupabaseProject(ref: string, name: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) {
    throw new Error("Your session looks expired — refresh the page and try again.");
  }
  // .select() so a silently-blocked update (permissions, RLS, or the row not existing)
  // surfaces as a real error instead of a false "saved" outcome — see disconnectSupabase()
  // for the same pattern and why it matters.
  const { data, error } = await supabase
    .from("supabase_connections")
    .update({ project_ref: ref, project_name: name } as any)
    .eq("user_id", userId)
    .select("user_id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't save your project selection — try reconnecting from Resources → Connectors.");
  }
}

export async function getSupabaseConnectionStatus(): Promise<SupabaseConnectionStatus> {
  const { data, error } = await supabase.rpc("get_supabase_connection_status");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    connected: !!row?.connected,
    project_ref: row?.project_ref ?? null,
    project_name: row?.project_name ?? null,
  };
}

export async function disconnectSupabase(): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) {
    throw new Error("Your session looks expired — refresh the page and try again.");
  }
  // .select() so we get back the row(s) actually removed: a DELETE that matches zero
  // rows (RLS denies it, the row is already gone, whatever the reason) succeeds with no
  // error and an empty result — silently telling the caller "disconnected" when nothing
  // changed. Checking the returned rows turns that into a real, visible failure instead.
  const { data, error } = await supabase
    .from("supabase_connections")
    .delete()
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't disconnect — no active Supabase connection was found to remove. Try refreshing the page.");
  }
}
