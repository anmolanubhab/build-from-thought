// path: src/services/domains.ts
import { supabase } from "@/integrations/supabase/client";

export interface DomainVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface ProjectDomain {
  id: string;
  project_id: string;
  domain: string;
  status: "pending" | "verified" | "misconfigured" | "error";
  verification: DomainVerificationChallenge[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchProjectDomains(projectId: string): Promise<ProjectDomain[]> {
  const { data, error } = await supabase
    .from("project_domains")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectDomain[];
}

export async function addProjectDomain(projectId: string, domain: string): Promise<ProjectDomain> {
  const { data, error } = await supabase.functions.invoke("vercel-domains", {
    body: { action: "add", project_id: projectId, domain },
  });
  if (error) throw new Error(error.message || "Failed to add domain");
  if (data?.error) throw new Error(data.error);
  return data.domain as ProjectDomain;
}

export async function removeProjectDomain(projectId: string, domain: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("vercel-domains", {
    body: { action: "remove", project_id: projectId, domain },
  });
  if (error) throw new Error(error.message || "Failed to remove domain");
  if (data?.error) throw new Error(data.error);
}

export interface DomainCheckResult {
  domain: ProjectDomain;
  misconfigured: boolean;
  verified: boolean;
}

export async function checkProjectDomain(projectId: string, domain: string): Promise<DomainCheckResult> {
  const { data, error } = await supabase.functions.invoke("vercel-domains", {
    body: { action: "check", project_id: projectId, domain },
  });
  if (error) throw new Error(error.message || "Failed to check domain");
  if (data?.error) throw new Error(data.error);
  return data as DomainCheckResult;
}
