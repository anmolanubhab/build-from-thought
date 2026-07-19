import { supabase } from "@/integrations/supabase/client";

export interface GeneratedApp {
  title: string;
  type: "portfolio" | "dashboard" | "landing" | "generic";
  html: string;
  css: string;
  react_code: string;
  pages?: { name: string; title: string; html: string }[];
  is_multipage?: boolean;
}

export async function generateApp(prompt: string, isMultipage: boolean = true): Promise<GeneratedApp> {
  const { data, error } = await supabase.functions.invoke("generate-app", {
    body: { prompt, is_multipage: isMultipage },
  });

  if (error) {
    throw new Error(error.message || "Failed to generate app");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as GeneratedApp;
}
