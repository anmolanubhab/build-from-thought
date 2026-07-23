// path: src/types/mcp.ts

export type McpAuthKind = "bearer" | "url_key" | "reuse_github_token";

export interface McpServerPreset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  endpoint_url: string | null;
  auth_kind: McpAuthKind;
  doc_url: string | null;
  is_active: boolean;
}

export type McpConnectionStatus = "connected" | "error" | "disconnected";

export interface McpConnection {
  id: string;
  workspace_id: string;
  server_id: string | null;
  name: string;
  endpoint_url: string;
  reuse_github_token: boolean;
  status: McpConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
  capabilities: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface McpTool {
  id: string;
  connection_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
  is_stale: boolean;
  updated_at: string;
}

export interface McpLogEntry {
  id: string;
  connection_id: string | null;
  workspace_id: string;
  invoked_by: string | null;
  tool_name: string;
  status: "ok" | "error";
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export type WorkspaceRoleForMcp = "owner" | "editor";

export interface McpPermission {
  id: string;
  connection_id: string;
  workspace_id: string;
  role: WorkspaceRoleForMcp;
  can_execute: boolean;
}

export interface McpChatToolTrace {
  tool_name: string;
  connection_name: string;
  status: "ok" | "error";
  summary?: string;
}

export interface McpChatResponse {
  answer: string;
  trace: McpChatToolTrace[];
}
