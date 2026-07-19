// path: src/services/vercelDeploy.ts
import { supabase } from "@/integrations/supabase/client";

export interface VercelConnectionStatus {
  connected: boolean;
  team_name: string | null;
  vercel_username: string | null;
}

export async function connectVercelWithToken(personalAccessToken: string): Promise<{ vercel_username: string | null }> {
  const { data, error } = await supabase.functions.invoke("vercel-connect", {
    body: { personal_access_token: personalAccessToken },
  });
  if (error) throw new Error(error.message || "Failed to connect Vercel");
  if (data?.error) throw new Error(data.error);
  return { vercel_username: data?.vercel_username ?? null };
}

export async function getVercelConnectionStatus(): Promise<VercelConnectionStatus> {
  const { data, error } = await supabase.rpc("get_vercel_connection_status");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    connected: !!row?.connected,
    team_name: row?.team_name ?? null,
    vercel_username: row?.vercel_username ?? null,
  };
}

export async function disconnectVercel(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("vercel_connections").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export interface VercelDeployResult {
  deployment_id: string;
  external_id: string;
  url: string;
  status: "building";
}

export async function deployToVercel(projectId: string, envVars: Record<string, string>): Promise<VercelDeployResult> {
  const { data, error } = await supabase.functions.invoke("vercel-deploy", {
    body: { project_id: projectId, env_vars: envVars },
  });
  if (error) throw new Error(error.message || "Deploy failed");
  if (data?.error) throw new Error(data.error);
  return data as VercelDeployResult;
}

export interface VercelDeployStatus {
  status: "building" | "success" | "failed" | "canceled";
  url: string | null;
  error_message: string | null;
  logs: string[];
}

export async function fetchVercelDeploymentStatus(deploymentId: string, includeLogs = false): Promise<VercelDeployStatus> {
  const { data, error } = await supabase.functions.invoke("vercel-deployment-status", {
    body: { deployment_id: deploymentId, include_logs: includeLogs },
  });
  if (error) throw new Error(error.message || "Failed to fetch status");
  if (data?.error) throw new Error(data.error);
  return data as VercelDeployStatus;
}

export interface DeploymentRecord {
  id: string;
  provider: string;
  status: string;
  deploy_url: string | null;
  error_message: string | null;
  env_var_keys: string[] | null;
  created_at: string;
  updated_at: string;
}

export async function fetchDeploymentHistory(projectId: string): Promise<DeploymentRecord[]> {
  const { data, error } = await supabase
    .from("deployments")
    .select("id, provider, status, deploy_url, error_message, env_var_keys, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeploymentRecord[];
}

export async function rollbackToDeployment(deploymentId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("vercel-rollback", {
    body: { deployment_id: deploymentId },
  });
  if (error) throw new Error(error.message || "Rollback failed");
  if (data?.error) throw new Error(data.error);
}

export interface BuildErrorExplanation {
  explanation: string;
  suggested_command: string | null;
}

export async function explainBuildError(errorMessage: string | null, logs: string[]): Promise<BuildErrorExplanation> {
  const { data, error } = await supabase.functions.invoke("explain-build-error", {
    body: { error_message: errorMessage, logs },
  });
  if (error) throw new Error(error.message || "Failed to get AI explanation");
  if (data?.error) throw new Error(data.error);
  return data as BuildErrorExplanation;
}
