// path: src/lib/documentation/types.ts
//
// Shared types for the Documentation Engine. Keep DocSectionKey in sync with
// supabase/functions/_shared/doc-sections.ts (Deno can't import this file
// directly, so the two lists are duplicated by design — see the comment
// there).

export type DocSectionKey =
  | "overview"
  | "project_report"
  | "technical"
  | "developer_guide"
  | "user_manual"
  | "api_docs"
  | "database_docs"
  | "architecture"
  | "testing"
  | "deployment_guide"
  | "readme"
  | "release_notes"
  | "ai_explain"
  | "viva_mode";

export type DocSource = "manual" | "ai" | "merge";
export type DocVersionSource = "manual_edit" | "ai_generate" | "merge" | "restore";
export type GenerationMode = "generate" | "regenerate" | "merge";
export type ExplainAudience = "client" | "viva";
export type VivaLevel = "basic" | "intermediate" | "advanced";

export interface VivaQuestion {
  question: string;
  answer: string;
}

export interface VivaCategory {
  level: VivaLevel;
  questions: VivaQuestion[];
}

export interface VivaContentJson {
  categories: VivaCategory[];
}

export interface DocumentationSection {
  id: string;
  project_id: string;
  section_key: DocSectionKey;
  title: string;
  content_md: string;
  content_json: Record<string, unknown> | null;
  source: DocSource;
  has_manual_edits: boolean;
  source_fingerprint: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentationSectionVersion {
  id: string;
  section_id: string;
  project_id: string;
  section_key: DocSectionKey;
  title: string;
  content_md: string;
  content_json: Record<string, unknown> | null;
  source: DocVersionSource;
  summary: string | null;
  created_by: string | null;
  created_at: string;
}

/** Result shape returned by the generate-documentation edge function. */
export interface GenerateDocumentationResult {
  title: string;
  content_md: string;
  content_json: Record<string, unknown> | null;
  fingerprint_inputs?: {
    file_count: number;
    has_database: boolean;
    deployment_count: number;
  };
}
