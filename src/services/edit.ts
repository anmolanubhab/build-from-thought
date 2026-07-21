// path: src/services/edit.ts
import { supabase } from "@/integrations/supabase/client";

export interface EditResult {
  summary: string;
  html: string;
  css: string;
  react_code: string;
  changes: string[];
  /** Full merged file map after the edit (modern projects only). */
  files?: Record<string, string> | null;
  /** Paths the AI actually touched in this edit (modern projects only). */
  changed_paths?: string[];
  /** Post-edit validation report (modern projects only). */
  qa?: {
    issues_found: number;
    auto_fixes: string[];
    ai_fixed: number;
    remaining: { file: string; issue: string }[];
  };
}

export async function editProject(
  prompt: string,
  currentHtml: string,
  currentCss: string,
  currentReactCode: string,
  mode: "apply" | "suggest" = "apply",
  files?: Record<string, string> | null,
  plan?: Record<string, unknown> | null,
): Promise<EditResult> {
  const { data, error } = await supabase.functions.invoke("edit-project", {
    body: { prompt, currentHtml, currentCss, currentReactCode, mode, files: files ?? undefined, plan: plan ?? undefined },
  });

  if (error) throw new Error(error.message || "Failed to edit project");
  if (data?.error) throw new Error(data.error);
  return data as EditResult;
}
