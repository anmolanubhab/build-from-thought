// path: src/services/aiReview.ts
import { supabase } from "@/integrations/supabase/client";

export interface LighthouseScores {
  performance: number;
  seo: number;
  accessibility: number;
  best_practices: number;
}

export interface AiSuggestion {
  title: string;
  detail: string;
}

export interface AnalysisResult {
  scores: LighthouseScores;
  suggestions: AiSuggestion[];
}

export async function analyzeDeployment(deploymentId: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-deployment", {
    body: { deployment_id: deploymentId },
  });
  if (error) throw new Error(error.message || "Analysis failed");
  if (data?.error) throw new Error(data.error);
  return data as AnalysisResult;
}

export interface AppliedFixes {
  summary: string;
  html: string;
  css: string;
  react_code: string;
}

export async function applyAiFixes(
  projectId: string,
  content: { html: string; css: string; react_code: string },
  suggestions: AiSuggestion[]
): Promise<AppliedFixes> {
  const { data, error } = await supabase.functions.invoke("apply-ai-fixes", {
    body: { project_id: projectId, ...content, suggestions },
  });
  if (error) throw new Error(error.message || "Failed to apply fixes");
  if (data?.error) throw new Error(data.error);
  return data as AppliedFixes;
}
