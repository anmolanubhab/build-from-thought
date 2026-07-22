// path: src/lib/documentation/registry.ts
//
// The Documentation Engine's UI registry — the ONE place the sidebar, the
// section editor, search, and export all read from. Adding a future
// document type (e.g. "Security Audit") means adding one entry here (plus a
// matching prompt entry in supabase/functions/_shared/doc-sections.ts) —
// nothing else in the UI needs to change, since every component below maps
// over this list instead of hardcoding a case per type.

import type { LucideIcon } from "lucide-react";
import {
  FileText, GraduationCap, Cpu, Code2, BookOpenText, Plug, Database,
  Building2, FlaskConical, Rocket, FileCode2, History, Sparkles,
  MessageCircleQuestion,
} from "lucide-react";
import type { DocSectionKey } from "./types";

export interface DocSectionMeta {
  key: DocSectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "core" | "ai-tools";
  /** Shown in the editor as a hint for what "Generate" will analyze. */
  analyzes: string;
}

export const DOC_SECTIONS: DocSectionMeta[] = [
  {
    key: "overview", label: "Overview", group: "core", icon: FileText,
    description: "Project name, description, objectives, target users, features, stack, dependencies, structure, future scope.",
    analyzes: "project prompt, framework, file tree, package dependencies",
  },
  {
    key: "project_report", label: "Project Report", group: "core", icon: GraduationCap,
    description: "Academic report generator for student submissions — exportable as DOCX/PDF.",
    analyzes: "full project context, framed as a formal academic report",
  },
  {
    key: "technical", label: "Technical Documentation", group: "core", icon: Cpu,
    description: "Architecture, app flow, auth flow, database flow, business logic, routing, security, performance.",
    analyzes: "file structure, routes, auth files, database schema, config",
  },
  {
    key: "developer_guide", label: "Developer Guide", group: "core", icon: Code2,
    description: "Setup, requirements, commands, env vars, folder layout, coding standards, contributing guide.",
    analyzes: "file tree, environment variables, framework conventions",
  },
  {
    key: "user_manual", label: "User Manual", group: "core", icon: BookOpenText,
    description: "Non-technical, plain-language guide: login, dashboard, features, FAQ, troubleshooting, glossary.",
    analyzes: "real pages/features, described for non-developers",
  },
  {
    key: "api_docs", label: "API Documentation", group: "core", icon: Plug,
    description: "Endpoints, methods, parameters, headers, auth, example requests/responses, error & status codes.",
    analyzes: "app/api/**/route.ts handlers in the project's file map",
  },
  {
    key: "database_docs", label: "Database Documentation", group: "core", icon: Database,
    description: "Tables, columns, relationships, indexes, foreign keys, policies, triggers, views, functions.",
    analyzes: "the project's connected Supabase schema",
  },
  {
    key: "architecture", label: "Architecture", group: "core", icon: Building2,
    description: "System, frontend, backend, auth, and deployment architecture; data flow; module interaction.",
    analyzes: "framework, routes, database layer, deployment provider",
  },
  {
    key: "testing", label: "Testing", group: "core", icon: FlaskConical,
    description: "Testing strategy, unit/integration/manual testing, known limitations, edge cases, bug process.",
    analyzes: "test files present (if any), real features to derive test cases",
  },
  {
    key: "deployment_guide", label: "Deployment Guide", group: "core", icon: Rocket,
    description: "Vercel, Netlify, Docker, self-hosting, Supabase, environment variables, production checklist.",
    analyzes: "connected deployment providers, env vars, domains",
  },
  {
    key: "readme", label: "README", group: "core", icon: FileCode2,
    description: "Professional GitHub README — description, features, installation, usage, folder structure, license.",
    analyzes: "project facts, formatted for a repository root README.md",
  },
  {
    key: "release_notes", label: "Release Notes", group: "core", icon: History,
    description: "What's in the current version — added / changed / fixed, grouped changelog style.",
    analyzes: "current file tree vs. the previous release notes entry",
  },
  {
    key: "ai_explain", label: "Explain This Project", group: "ai-tools", icon: Sparkles,
    description: "AI walkthrough of how the project works, tailored for a client presentation or a college viva.",
    analyzes: "everything — written for a human audience, not as reference docs",
  },
  {
    key: "viva_mode", label: "Viva Mode", group: "ai-tools", icon: MessageCircleQuestion,
    description: "Interview questions (Basic / Intermediate / Advanced) with expected answers, for exam prep.",
    analyzes: "the real project, to generate defensible Q&A",
  },
];

export const DOC_SECTION_KEYS: DocSectionKey[] = DOC_SECTIONS.map((s) => s.key);

export const DEFAULT_SECTION_KEY: DocSectionKey = "overview";

export function getSectionMeta(key: DocSectionKey): DocSectionMeta {
  const meta = DOC_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown documentation section: ${key}`);
  return meta;
}

export const GROUP_LABELS: Record<DocSectionMeta["group"], string> = {
  core: "Documentation",
  "ai-tools": "AI Tools",
};

/** Sections that carry structured content_json beyond markdown (rendered specially). */
export const STRUCTURED_SECTIONS: DocSectionKey[] = ["viva_mode"];
