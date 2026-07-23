// path: src/lib/workspaces.ts
export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  invite_code: string;
  avatar_url: string | null;
  handle: string | null;
  default_member_credit_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "editor";
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null; is_public: boolean } | null;
}

/** One row of the People table: an active member or a pending invitation, from get_workspace_roster(). */
export interface WorkspaceRosterEntry {
  kind: "member" | "invitation";
  id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: "owner" | "editor";
  status: "active" | "pending" | "accepted" | "revoked";
  joined_at: string;
  credit_limit: number | null;
  usage_month: number;
  usage_total: number;
}

export const CURRENT_WORKSPACE_STORAGE_KEY = "current_workspace_id";
