// path: src/lib/workspaces.ts
export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  profile?: { display_name: string | null; username: string | null } | null;
}

export const CURRENT_WORKSPACE_STORAGE_KEY = "current_workspace_id";
