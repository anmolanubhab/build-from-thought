import { supabase } from "@/integrations/supabase/client";

export interface EditResult {
  summary: string;
  html: string;
  css: string;
  react_code: string;
  changes: string[];
}

export async function editProject(
  prompt: string,
  currentHtml: string,
  currentCss: string,
  currentReactCode: string,
  mode: "apply" | "suggest" = "apply"
): Promise<EditResult> {
  const { data, error } = await supabase.functions.invoke("edit-project", {
    body: { prompt, currentHtml, currentCss, currentReactCode, mode },
  });

  if (error) throw new Error(error.message || "Failed to edit project");
  if (data?.error) throw new Error(data.error);
  return data as EditResult;
}
