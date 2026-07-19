import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export async function getGitHubStatus(): Promise<{ connected: boolean; username?: string }> {
  const { data } = await supabase
    .from("github_tokens")
    .select("github_username")
    .maybeSingle();

  if (data) return { connected: true, username: (data as any).github_username };
  return { connected: false };
}

export async function startGitHubAuth(): Promise<void> {
  const callbackUrl = `${window.location.origin}/dashboard?github_callback=true`;
  const res = await fetch(`${FUNCTIONS_URL}/github-auth?redirect_uri=${encodeURIComponent(callbackUrl)}`);
  const { url, error } = await res.json();
  if (error) throw new Error(error);
  window.location.href = url;
}

export async function exchangeGitHubCode(code: string): Promise<{ github_username: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const res = await fetch(`${FUNCTIONS_URL}/github-callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, user_id: user.id }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function pushToGitHub(projectId: string, repoName: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${FUNCTIONS_URL}/github-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId, repo_name: repoName }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.repo_url;
}

export async function disconnectGitHub(): Promise<void> {
  const { error } = await supabase.from("github_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}
