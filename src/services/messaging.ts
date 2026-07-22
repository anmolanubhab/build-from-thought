// path: src/services/messaging.ts
import { supabase } from "@/integrations/supabase/client";

export type MessagingProvider = "telegram" | "whatsapp";

export interface MessagingConnection {
  provider: MessagingProvider;
  status: "connected" | "not_connected";
  connectedAt: string | null;
  metadata: Record<string, unknown>;
}

/**
 * supabase-js's functions.invoke() collapses ANY non-2xx edge function response into a
 * generic FunctionsHttpError — the real `{ error }` JSON body is only reachable via
 * `error.context` (the raw fetch Response). Same pattern as src/services/database.ts and
 * src/services/userSupabase.ts — duplicated here for the same reason (no shared import
 * path without a cross-service dependency).
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

function emptyConnections(): Record<MessagingProvider, MessagingConnection> {
  return {
    telegram: { provider: "telegram", status: "not_connected", connectedAt: null, metadata: {} },
    whatsapp: { provider: "whatsapp", status: "not_connected", connectedAt: null, metadata: {} },
  };
}

/** Fetches the caller's messaging connections. A missing row simply means "not connected". */
export async function fetchMessagingConnections(userId: string): Promise<Record<MessagingProvider, MessagingConnection>> {
  const base = emptyConnections();
  const { data, error } = await supabase
    .from("connected_apps")
    .select("provider, status, connected_at, metadata")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{ provider: string; status: string; connected_at: string; metadata: Record<string, unknown> }>) {
    if (row.provider === "telegram" || row.provider === "whatsapp") {
      base[row.provider] = {
        provider: row.provider,
        status: row.status === "connected" ? "connected" : "not_connected",
        connectedAt: row.connected_at,
        metadata: row.metadata ?? {},
      };
    }
  }
  return base;
}

export interface TelegramLinkInfo {
  code: string;
  deepLink: string;
  expiresAt: string;
}

/** Starts a Telegram link flow: returns a one-time code + t.me deep link the user opens in Telegram. */
export async function startTelegramLink(): Promise<TelegramLinkInfo> {
  const { data, error } = await supabase.functions.invoke("telegram-connect", { body: {} });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Couldn't start the Telegram connection."));
  if (data?.error) throw new Error(data.error);
  return { code: data.code as string, deepLink: data.deep_link as string, expiresAt: data.expires_at as string };
}

/**
 * Disconnects a messaging provider for the current user. `.select()` so a delete that
 * silently matches zero rows (RLS, the row already gone, whatever) surfaces as a real
 * error instead of a false "disconnected" — same pattern as disconnectSupabase().
 */
export async function disconnectMessaging(provider: MessagingProvider, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("connected_apps")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't disconnect — no active connection was found. Try refreshing the page.");
  }
}
