// path: src/services/netlifyDeploy.ts
import { supabase } from "@/integrations/supabase/client";

export interface NetlifyConnectionStatus {
  connected: boolean;
  netlify_email: string | null;
}

export async function connectNetlifyWithToken(personalAccessToken: string): Promise<{ netlify_email: string | null }> {
  const { data, error } = await supabase.functions.invoke("netlify-connect", {
    body: { personal_access_token: personalAccessToken },
  });
  if (error) throw new Error(error.message || "Failed to connect Netlify");
  if (data?.error) throw new Error(data.error);
  return { netlify_email: data?.netlify_email ?? null };
}

export async function getNetlifyConnectionStatus(): Promise<NetlifyConnectionStatus> {
  const { data, error } = await supabase.rpc("get_netlify_connection_status");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { connected: !!row?.connected, netlify_email: row?.netlify_email ?? null };
}

export async function disconnectNetlify(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("netlify_connections").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export interface NetlifyDeployResult {
  deployment_id: string;
  url: string;
  status: "building";
}

export async function deployToNetlify(projectId: string): Promise<NetlifyDeployResult> {
  const { data, error } = await supabase.functions.invoke("netlify-deploy", {
    body: { project_id: projectId },
  });
  if (error) throw new Error(error.message || "Deploy failed");
  if (data?.error) throw new Error(data.error);
  return data as NetlifyDeployResult;
}

export interface NetlifyDeployStatus {
  status: "building" | "success" | "failed";
  url: string | null;
  error_message: string | null;
}

export async function fetchNetlifyDeploymentStatus(deploymentId: string): Promise<NetlifyDeployStatus> {
  const { data, error } = await supabase.functions.invoke("netlify-deployment-status", {
    body: { deployment_id: deploymentId },
  });
  if (error) throw new Error(error.message || "Failed to fetch status");
  if (data?.error) throw new Error(data.error);
  return data as NetlifyDeployStatus;
}
