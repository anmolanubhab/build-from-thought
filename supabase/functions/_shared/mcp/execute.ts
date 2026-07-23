// path: supabase/functions/_shared/mcp/execute.ts
// The core "call a tool" dispatcher: permission check, staleness check,
// rate limiting, input validation, the actual MCP call, and one mcp_logs
// row per attempt (success or failure). Shared by mcp-execute (HTTP) and
// mcp-chat (the internal tool-planner loop), so this logic lives once.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mcpCallTool } from "./transport.ts";
import { resolveConnectionAuth } from "./resolve.ts";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 30;
const MAX_LOGGED_CHARS = 2000;
const MAX_RESULT_CHARS = 50_000;
const SECRET_KEY_PATTERN = /token|secret|password|apikey|api_key|authorization/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

function truncate(value: unknown, maxChars: number): unknown {
  const text = JSON.stringify(value);
  if (text.length <= maxChars) return value;
  return { truncated: true, preview: text.slice(0, maxChars) };
}

export class ExecuteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ExecuteParams {
  connectionId: string;
  toolName: string;
  args: Record<string, unknown>;
  workspaceId: string;
  invokedBy: string;
  role: "owner" | "editor";
}

export async function executeToolAndLog(admin: SupabaseClient, params: ExecuteParams): Promise<unknown> {
  const { connectionId, toolName, args, workspaceId, invokedBy, role } = params;

  const { data: connection } = await admin
    .from("mcp_connections")
    .select("id, workspace_id, endpoint_url, vault_secret_id, reuse_github_token, server_id, created_by, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection || connection.workspace_id !== workspaceId) throw new ExecuteError("Connection not found", 404);
  if (connection.status !== "connected") throw new ExecuteError("Connection isn't active", 400);

  if (role !== "owner") {
    const { data: permission } = await admin
      .from("mcp_permissions")
      .select("can_execute")
      .eq("connection_id", connectionId)
      .eq("role", role)
      .maybeSingle();
    if (!permission?.can_execute) throw new ExecuteError("You don't have permission to run this tool", 403);
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("mcp_logs")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_CALLS) throw new ExecuteError("Rate limit exceeded for this connection — try again shortly", 429);

  const { data: toolRow } = await admin
    .from("mcp_tools")
    .select("name, input_schema, is_stale")
    .eq("connection_id", connectionId)
    .eq("name", toolName)
    .maybeSingle();
  if (!toolRow || toolRow.is_stale) throw new ExecuteError(`Tool "${toolName}" isn't available on this connection — try Refresh Tools`, 400);

  const requiredFields = (toolRow.input_schema as Record<string, unknown> | null)?.required;
  if (Array.isArray(requiredFields)) {
    const missing = requiredFields.filter((f: string) => args?.[f] === undefined);
    if (missing.length > 0) throw new ExecuteError(`Missing required argument(s): ${missing.join(", ")}`, 400);
  }

  const startedAt = Date.now();
  try {
    const { url, auth } = await resolveConnectionAuth(admin, connection);
    const result = await mcpCallTool(url, auth, toolName, args ?? {});
    const durationMs = Date.now() - startedAt;

    await admin.from("mcp_logs").insert({
      connection_id: connectionId,
      workspace_id: workspaceId,
      invoked_by: invokedBy,
      tool_name: toolName,
      request_args: truncate(redact(args), MAX_LOGGED_CHARS),
      status: "ok",
      duration_ms: durationMs,
    });

    return truncate(result, MAX_RESULT_CHARS);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Tool execution failed";
    await admin.from("mcp_logs").insert({
      connection_id: connectionId,
      workspace_id: workspaceId,
      invoked_by: invokedBy,
      tool_name: toolName,
      request_args: truncate(redact(args), MAX_LOGGED_CHARS),
      status: "error",
      duration_ms: durationMs,
      error_message: message,
    });
    throw err instanceof ExecuteError ? err : new ExecuteError(message, 502);
  }
}
