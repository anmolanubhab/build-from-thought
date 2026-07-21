// path: src/services/deviceConnections.ts
import { supabase } from "@/integrations/supabase/client";

export type ConnectedAppProvider = "github" | "vercel" | "netlify" | "supabase";

export interface ConnectedApp {
  provider: ConnectedAppProvider;
  label: string;
  connectedAt: string;
}

/** Reads only the safe display columns from each provider table — access_token is never selected. */
export async function fetchConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const [github, vercel, netlify, supabaseConn] = await Promise.all([
    supabase.from("github_tokens").select("github_username, created_at").eq("user_id", userId).maybeSingle(),
    supabase.from("vercel_connections").select("vercel_username, created_at").eq("user_id", userId).maybeSingle(),
    supabase.from("netlify_connections").select("netlify_email, created_at").eq("user_id", userId).maybeSingle(),
    supabase.from("supabase_connections").select("project_name, created_at").eq("user_id", userId).maybeSingle(),
  ]);

  if (github.error) throw new Error(github.error.message);
  if (vercel.error) throw new Error(vercel.error.message);
  if (netlify.error) throw new Error(netlify.error.message);
  if (supabaseConn.error) throw new Error(supabaseConn.error.message);

  const apps: ConnectedApp[] = [];

  if (github.data) {
    apps.push({
      provider: "github",
      label: (github.data as any).github_username || "GitHub",
      connectedAt: (github.data as any).created_at,
    });
  }
  if (vercel.data) {
    apps.push({
      provider: "vercel",
      label: (vercel.data as any).vercel_username || "Vercel",
      connectedAt: (vercel.data as any).created_at,
    });
  }
  if (netlify.data) {
    apps.push({
      provider: "netlify",
      label: (netlify.data as any).netlify_email || "Netlify",
      connectedAt: (netlify.data as any).created_at,
    });
  }
  if (supabaseConn.data) {
    apps.push({
      provider: "supabase",
      label: (supabaseConn.data as any).project_name || "Supabase",
      connectedAt: (supabaseConn.data as any).created_at,
    });
  }

  return apps;
}

const PROVIDER_TABLE: Record<ConnectedAppProvider, string> = {
  github: "github_tokens",
  vercel: "vercel_connections",
  netlify: "netlify_connections",
  supabase: "supabase_connections",
};

export async function disconnectApp(provider: ConnectedAppProvider, userId: string): Promise<void> {
  const { error } = await supabase.from(PROVIDER_TABLE[provider] as any).delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
