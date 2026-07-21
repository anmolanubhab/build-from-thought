// path: src/services/ai.ts
import { supabase } from "@/integrations/supabase/client";

/** Structured execution plan produced by the Planner Agent (plan-project). */
export interface ProjectPlan {
  understanding: string;
  project_type: string;
  legacy_type: string;
  title: string;
  description: string;
  routes: { path: string; purpose: string }[];
  components: { file: string; purpose: string; client?: boolean }[];
  needs_database: boolean;
  needs_auth: boolean;
  needs_api: boolean;
  database_tables: { name: string; purpose: string; columns: string[] }[];
  dependencies: string[];
  design: { mode?: string; style?: string; accent?: string; notes?: string };
  milestones: string[];
  complexity: "low" | "medium" | "high";
}

export interface QaReport {
  issues_found: number;
  auto_fixes: string[];
  ai_fixed: number;
  remaining: { file: string; issue: string }[];
}

export interface GeneratedApp {
  title: string;
  type: "portfolio" | "dashboard" | "landing" | "generic";
  html: string;
  css: string;
  react_code: string;
  pages?: { name: string; title: string; html: string }[];
  is_multipage?: boolean;
  /** Full Next.js project file map for modern-stack generations. */
  files?: Record<string, string> | null;
  stack?: string;
  plan?: ProjectPlan | null;
  qa?: QaReport | null;
  credits_remaining?: number;
}

/** Planner Agent: produces the execution plan before any code is generated. Free (no credit). */
export async function planProject(prompt: string, isMultipage: boolean = true): Promise<ProjectPlan> {
  const { data, error } = await supabase.functions.invoke("plan-project", {
    body: { prompt, is_multipage: isMultipage },
  });
  if (error) throw new Error(error.message || "Planning failed");
  if (data?.error) throw new Error(data.error);
  return data.plan as ProjectPlan;
}

export async function generateApp(
  prompt: string,
  isMultipage: boolean = true,
  plan?: ProjectPlan | null,
): Promise<GeneratedApp> {
  const { data, error } = await supabase.functions.invoke("generate-app", {
    body: { prompt, is_multipage: isMultipage, plan: plan ?? undefined },
  });

  if (error) {
    throw new Error(error.message || "Failed to generate app");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as GeneratedApp;
}
