// path: src/services/mcp/mcpManager.ts
// Thin wrapper around the mcp-* edge functions — every live action (connect,
// disconnect, refresh tools, execute a tool, chat with tools) goes through
// here rather than talking to any MCP server directly from the browser.
import { supabase } from "@/integrations/supabase/client";
import type { McpChatResponse, McpConnection, McpTool } from "@/types/mcp";

/**
 * supabase-js's functions.invoke() collapses any non-2xx edge function response into a
 * generic FunctionsHttpError; the real `{ error }` JSON body is only reachable via
 * error.context (the raw fetch Response). Without this, every real error message from
 * mcp-connect/mcp-execute/etc. would be swallowed and replaced with a generic string.
 */
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      const msg = (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // Response body wasn't JSON (or already consumed) — fall through.
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

export interface ConnectMcpInput {
  workspaceId: string;
  serverSlug?: string;
  customUrl?: string;
  name?: string;
  token?: string;
  connectionId?: string;
}

export async function connectMcp(input: ConnectMcpInput): Promise<McpConnection> {
  const { data, error } = await supabase.functions.invoke("mcp-connect", {
    body: {
      workspace_id: input.workspaceId,
      server_slug: input.serverSlug,
      custom_url: input.customUrl,
      name: input.name,
      token: input.token,
      connection_id: input.connectionId,
    },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Couldn't connect to that MCP server"));
  if (data?.error) throw new Error(data.error);
  return data.connection as McpConnection;
}

export async function disconnectMcp(connectionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("mcp-disconnect", { body: { connection_id: connectionId } });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Couldn't disconnect"));
  if (data?.error) throw new Error(data.error);
}

export async function refreshMcpTools(connectionId: string): Promise<McpTool[]> {
  const { data, error } = await supabase.functions.invoke("mcp-refresh-tools", { body: { connection_id: connectionId } });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Couldn't refresh tools"));
  if (data?.error) throw new Error(data.error);
  return (data.tools ?? []) as McpTool[];
}

export async function executeMcpTool(
  workspaceId: string,
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("mcp-execute", {
    body: { workspace_id: workspaceId, connection_id: connectionId, tool_name: toolName, args },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Tool execution failed"));
  if (data?.error) throw new Error(data.error);
  return data.result;
}

export async function chatWithMcpTools(workspaceId: string, message: string): Promise<McpChatResponse> {
  const { data, error } = await supabase.functions.invoke("mcp-chat", {
    body: { workspace_id: workspaceId, message },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, "Couldn't get a response"));
  if (data?.error) throw new Error(data.error);
  return data as McpChatResponse;
}
