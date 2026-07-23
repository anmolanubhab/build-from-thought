// path: supabase/functions/_shared/mcp/jsonrpc.ts
// Minimal JSON-RPC 2.0 envelope helpers for talking to MCP servers.

let nextId = 1;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export function buildRequest(method: string, params?: unknown): JsonRpcRequest {
  return { jsonrpc: "2.0", id: nextId++, method, params };
}

export function buildNotification(method: string, params?: unknown): JsonRpcNotification {
  return { jsonrpc: "2.0", method, params };
}

export function parseResponse<T>(body: unknown): T {
  const res = body as JsonRpcResponse<T>;
  if (res?.error) throw new Error(`MCP error ${res.error.code}: ${res.error.message}`);
  return res?.result as T;
}
