// path: supabase/functions/_shared/mcp/transport.ts
// MCP "Streamable HTTP" transport: JSON-RPC over a single POST endpoint,
// with the response either a plain JSON body or a short text/event-stream
// (we only ever need the final message for initialize/tools-list/tools-call,
// not open-ended streaming, so a minimal SSE reader is sufficient here).

import { buildNotification, buildRequest, parseResponse } from "./jsonrpc.ts";

const TIMEOUT_MS = 15_000;
const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface McpAuth {
  kind: "bearer" | "none";
  token?: string;
}

interface RawCallResult {
  raw: unknown;
  sessionId?: string;
}

function isTransientError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /fetch|network|ECONNRESET/i.test(err.message));
}

async function postOnce(url: string, auth: McpAuth, body: unknown, sessionId?: string): Promise<RawCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    };
    if (auth.kind === "bearer" && auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const respSessionId = res.headers.get("Mcp-Session-Id") ?? undefined;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MCP server responded ${res.status}: ${text.slice(0, 500)}`);
    }

    // A JSON-RPC notification (no id) has no meaningful response body.
    if (res.status === 202) return { raw: null, sessionId: respSessionId };

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      const dataLines = text.split("\n").filter((l) => l.startsWith("data:"));
      const lastData = dataLines[dataLines.length - 1]?.slice(5).trim();
      if (!lastData) throw new Error("Empty MCP event-stream response");
      return { raw: JSON.parse(lastData), sessionId: respSessionId };
    }

    return { raw: await res.json(), sessionId: respSessionId };
  } finally {
    clearTimeout(timeout);
  }
}

export interface McpCallResult<T> {
  result: T;
  sessionId?: string;
}

/** One JSON-RPC request/response round trip, with a single retry on transient network failure. */
export async function mcpCall<T>(
  url: string,
  auth: McpAuth,
  method: string,
  params?: unknown,
  sessionId?: string,
): Promise<McpCallResult<T>> {
  const body = buildRequest(method, params);
  try {
    const { raw, sessionId: newSessionId } = await postOnce(url, auth, body, sessionId);
    return { result: parseResponse<T>(raw), sessionId: newSessionId ?? sessionId };
  } catch (err) {
    if (!isTransientError(err)) throw err;
    const { raw, sessionId: newSessionId } = await postOnce(url, auth, body, sessionId);
    return { result: parseResponse<T>(raw), sessionId: newSessionId ?? sessionId };
  }
}

/** Fire-and-forget JSON-RPC notification (no response expected). */
async function mcpNotify(url: string, auth: McpAuth, method: string, params: unknown, sessionId?: string): Promise<void> {
  try {
    await postOnce(url, auth, buildNotification(method, params), sessionId);
  } catch {
    // Best-effort: some servers don't require the "initialized" notification at all.
  }
}

export async function mcpInitialize(url: string, auth: McpAuth): Promise<{ sessionId?: string; capabilities: Record<string, unknown> }> {
  const { result, sessionId } = await mcpCall<{ capabilities?: Record<string, unknown> }>(url, auth, "initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "WebdevsAI", version: "1.0.0" },
  });
  await mcpNotify(url, auth, "notifications/initialized", {}, sessionId);
  return { sessionId, capabilities: result?.capabilities ?? {} };
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export async function mcpListTools(url: string, auth: McpAuth, sessionId?: string): Promise<McpToolDef[]> {
  const { result } = await mcpCall<{ tools: McpToolDef[] }>(url, auth, "tools/list", {}, sessionId);
  return result?.tools ?? [];
}

export async function mcpCallTool(
  url: string,
  auth: McpAuth,
  toolName: string,
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<unknown> {
  const { result } = await mcpCall<unknown>(url, auth, "tools/call", { name: toolName, arguments: args }, sessionId);
  return result;
}
