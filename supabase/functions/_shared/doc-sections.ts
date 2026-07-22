// path: supabase/functions/_shared/doc-sections.ts
//
// Documentation Engine — shared prompt registry (Deno side).
//
// This is the single place that knows how to turn "a project" into "a system
// prompt for section X". Every doc type is a data-driven entry, not a branch
// of custom code — adding a new document type later means adding one entry
// here (and one matching entry in src/lib/documentation/registry.ts for the
// sidebar), never touching generate-documentation/index.ts itself.
//
// Keep DOC_SECTION_KEYS in sync with src/lib/documentation/types.ts.

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

export const DOC_SECTION_KEYS: DocSectionKey[] = [
  "overview", "project_report", "technical", "developer_guide", "user_manual",
  "api_docs", "database_docs", "architecture", "testing", "deployment_guide",
  "readme", "release_notes", "ai_explain", "viva_mode",
];

export interface DatabaseFacts {
  provider: string;
  mode: string;
  table_prefix: string | null;
  tables: string[];
}

export interface DeploymentFacts {
  provider: string;
  status: string;
  deploy_url: string | null;
}

export interface ProjectFacts {
  title: string;
  prompt: string;
  stack?: string | null;
  type?: string | null;
  is_multipage?: boolean;
  files: Record<string, string> | null;
  plan: Record<string, unknown> | null;
  database: DatabaseFacts | null;
  deployments: DeploymentFacts[];
  domains: string[];
  githubConnected: boolean;
}

export type GenerationMode = "generate" | "regenerate" | "merge";
export type ExplainAudience = "client" | "viva";
export type VivaLevel = "basic" | "intermediate" | "advanced";

export interface SectionRequest {
  key: DocSectionKey;
  mode: GenerationMode;
  /** Current markdown in the editor — passed for "regenerate" (context) and required for "merge". */
  existingMarkdown?: string;
  /** ai_explain only. */
  audience?: ExplainAudience;
  /** viva_mode only — defaults to all three when omitted. */
  levels?: VivaLevel[];
}

// ---------------------------------------------------------------------------
// Project facts block — shared by every section so the model never invents
// what it can instead read straight from the real project.
// ---------------------------------------------------------------------------

function detectFramework(files: Record<string, string> | null): string {
  if (!files || Object.keys(files).length === 0) return "Static HTML/CSS (legacy single/multi-page project)";
  const paths = Object.keys(files);
  const hasAppRouter = paths.some((p) => p.startsWith("app/"));
  const hasNext = paths.some((p) => p === "next.config.ts" || p === "next.config.js");
  if (hasNext || hasAppRouter) return "Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS";
  return "React + TypeScript";
}

function summarizeFiles(files: Record<string, string> | null): string {
  if (!files || Object.keys(files).length === 0) return "(no modern file map — legacy static HTML/CSS project)";
  const paths = Object.keys(files).sort();
  return paths.map((p) => `- ${p}`).join("\n");
}

function extractRoutes(files: Record<string, string> | null): string {
  if (!files) return "(none)";
  const routePages = Object.keys(files).filter((p) => /^app\/.*page\.tsx$/.test(p));
  if (routePages.length === 0) return "(no app-router page files found)";
  return routePages
    .map((p) => {
      const route = p.replace(/^app/, "").replace(/\/page\.tsx$/, "") || "/";
      const isClient = /^\s*["']use client["']/.test(files[p] || "");
      return `- ${route} (${p})${isClient ? " [client component]" : ""}`;
    })
    .join("\n");
}

function extractApiRoutes(files: Record<string, string> | null): string {
  if (!files) return "(none)";
  const apiFiles = Object.keys(files).filter((p) => /^app\/api\/.*route\.ts$/.test(p));
  if (apiFiles.length === 0) return "(no app/api/**/route.ts handlers found)";
  return apiFiles
    .map((p) => {
      const content = files[p] || "";
      const methods = [...content.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)].map((m) => m[1]);
      const route = p.replace(/^app/, "").replace(/\/route\.ts$/, "");
      return `- ${route} — methods: ${methods.length ? methods.join(", ") : "unknown (inspect file)"} (${p})`;
    })
    .join("\n");
}

function extractEnvVars(files: Record<string, string> | null): string {
  if (!files) return "(none detected)";
  const names = new Set<string>();
  for (const content of Object.values(files)) {
    for (const m of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(m[1]);
  }
  if (files[".env.example"]) {
    for (const line of files[".env.example"].split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=/);
      if (m) names.add(m[1]);
    }
  }
  return names.size ? [...names].sort().map((n) => `- ${n}`).join("\n") : "(none detected)";
}

function extractAuth(files: Record<string, string> | null): string {
  if (!files) return "(no auth code found in file map)";
  const authFiles = Object.keys(files).filter((p) => /auth/i.test(p));
  if (authFiles.length === 0) return "(no auth-related files found — project likely has no authentication)";
  return authFiles.map((p) => `- ${p}`).join("\n");
}

function extractComponents(files: Record<string, string> | null): string {
  if (!files) return "(none)";
  const comps = Object.keys(files).filter((p) => p.startsWith("components/"));
  return comps.length ? comps.map((p) => `- ${p}`).join("\n") : "(no components/ directory found)";
}

function buildFactsBlock(facts: ProjectFacts): string {
  const framework = detectFramework(facts.files);
  const db = facts.database
    ? `Provider: ${facts.database.provider} · Mode: ${facts.database.mode}${facts.database.table_prefix ? ` · Table prefix: ${facts.database.table_prefix}` : ""}\nTables: ${facts.database.tables.length ? facts.database.tables.join(", ") : "(provisioned, no tables yet)"}`
    : "No database connected to this project.";
  const deploy = facts.deployments.length
    ? facts.deployments.map((d) => `- ${d.provider}: ${d.status}${d.deploy_url ? ` — ${d.deploy_url}` : ""}`).join("\n")
    : "Not deployed yet.";

  return `=== REAL PROJECT FACTS (use these — never invent details that contradict or replace them) ===
Project name: ${facts.title}
Original request/prompt: ${facts.prompt}
Detected framework/stack: ${framework}${facts.stack ? ` (declared stack: ${facts.stack})` : ""}
Multi-page: ${facts.is_multipage ? "yes" : "no"}

FILE TREE:
${summarizeFiles(facts.files)}

DETECTED PAGES/ROUTES:
${extractRoutes(facts.files)}

DETECTED API ROUTES:
${extractApiRoutes(facts.files)}

DETECTED ENVIRONMENT VARIABLES (names only — never invent secret values):
${extractEnvVars(facts.files)}

AUTHENTICATION-RELATED FILES:
${extractAuth(facts.files)}

COMPONENTS:
${extractComponents(facts.files)}

DATABASE:
${db}

DEPLOYMENTS:
${deploy}
Custom domains: ${facts.domains.length ? facts.domains.join(", ") : "(none)"}
GitHub: ${facts.githubConnected ? "connected" : "not connected"}
${facts.plan ? `\nPLANNER AGENT CONTEXT (original execution plan):\nType: ${(facts.plan as any).project_type || "?"} · Complexity: ${(facts.plan as any).complexity || "?"}\nUnderstanding: ${(facts.plan as any).understanding || ""}\nDesign: ${(facts.plan as any).design ? `${(facts.plan as any).design.mode || ""} mode · ${(facts.plan as any).design.style || ""}` : "?"}` : ""}
=== END PROJECT FACTS ===`;
}

// ---------------------------------------------------------------------------
// Per-section instructions. Each entry focuses the model on what THIS
// document type needs to extract/explain from the facts above.
// ---------------------------------------------------------------------------

const SECTION_INSTRUCTIONS: Record<DocSectionKey, (facts: ProjectFacts) => string> = {
  overview: () => `Write the OVERVIEW document for this project. Cover, as markdown sections:
# Project Name, ## Description, ## Objectives, ## Target Users, ## Features (bulleted, derived from actual pages/components — not generic), ## Technology Stack (from the detected framework/files), ## Dependencies (from package.json if present in the file tree), ## Project Structure (a short annotated tree from the real file list), ## Future Scope (a few grounded, plausible next steps given what exists today).`,

  project_report: () => `Write an ACADEMIC PROJECT REPORT suitable for a student submission (college/university), formatted for later export to DOCX/PDF. Include, as clearly separated markdown sections in this order:
# <Project Title>, ## Certificate Template (a fill-in-the-blank certificate placeholder block, clearly marked as a template), ## Acknowledgement (a short generic template paragraph, clearly marked as editable), ## Abstract, ## 1. Introduction, ## 2. Problem Statement, ## 3. Existing System, ## 4. Proposed System, ## 5. Objectives, ## 6. Modules (derived from real pages/components/API routes), ## 7. Technology Stack, ## 8. Database Design (use real schema if connected; otherwise state the intended design), ## 9. Architecture, ## 10. Testing, ## 11. Advantages, ## 12. Limitations, ## 13. Future Scope, ## 14. Conclusion, ## 15. References.
Where the real project doesn't yet contain something a formal report normally needs (e.g. a cover page owner/institution name), insert a clearly marked "*(fill in: ...)*" placeholder rather than inventing a fake institution or name.`,

  technical: () => `Write the TECHNICAL DOCUMENTATION. Cover: ## Architecture Overview, ## Application Flow, ## Folder Structure (real tree, annotated), ## Authentication Flow (based on the detected auth files — state clearly if there is none), ## Database Flow (based on real schema/connection state), ## Business Logic (inferred from actual routes/components), ## Component Hierarchy, ## Routing (real detected routes), ## Deployment Architecture (real deployment/provider info), ## Configuration (real env vars, config files), ## Error Handling, ## Security, ## Performance. Ground every claim in the facts above; where something can't be verified from the given files, say so explicitly instead of guessing specifics.`,

  developer_guide: () => `Write the DEVELOPER GUIDE (onboarding doc for a new engineer joining this codebase). Cover: ## Development Setup, ## Requirements, ## Installation, ## Commands (infer from package.json scripts if visible in the file tree, else standard framework commands), ## Environment Variables (the real detected names, with a one-line purpose guess per var where inferable from usage), ## Folder Explanation (real folders only), ## Coding Standards (inferred from the actual code style visible in files), ## State Management (name the real approach used, e.g. React Query/hooks/context if detected), ## Database Layer (real), ## Deployment, ## Best Practices, ## Contributing Guide.`,

  user_manual: () => `Write a complete USER MANUAL for NON-DEVELOPERS — someone who has never seen code. Avoid all jargon; explain every technical term in plain language the first time it appears. Cover: ## Installation (as "getting started" from a normal user's point of view — accessing the deployed URL, not npm/git), ## Login, ## Dashboard, ## Navigation, ## Features (walk through each real page/feature in the project, described as a task the user performs), ## Settings, ## Common Tasks (numbered step-by-step), ## FAQ, ## Troubleshooting, ## Glossary (plain-language definitions of any unavoidable technical terms). Base every feature described on the real pages/components in the facts above — never describe a feature that doesn't exist in the file tree.`,

  api_docs: () => `Write the API DOCUMENTATION by inspecting the DETECTED API ROUTES above. For EACH real API route found, document: endpoint path, HTTP method(s), required headers/authentication, request parameters/body shape (inferred from the route file's code), an example request, an example response, and applicable error/status codes. Structure as: ## Authentication (overall scheme, if any), then one ## subsection per endpoint, then ## Error Codes, ## Status Codes, ## Rate Limits (state "not implemented" if none is visible in the code rather than inventing limits). If there are NO detected API routes, say so plainly at the top and do not fabricate endpoints.`,

  database_docs: (facts) => `Write the DATABASE DOCUMENTATION by inspecting the DATABASE facts above.${facts.database ? "" : " No database is connected to this project — say so clearly and describe how one would be added, rather than inventing a schema."} Cover: ## Tables, ## Columns, ## Relationships, ## Indexes, ## Foreign Keys, ## Policies (RLS), ## Triggers, ## Views, ## Functions, ## ER Explanation (a plain-language walkthrough of how the real tables relate). Only describe tables/columns that are actually listed in the facts — for anything not introspectable from the given data (e.g. exact column types), state that explicitly instead of guessing.`,

  architecture: () => `Write the ARCHITECTURE documentation. Cover: ## System Architecture (a high-level picture of client/server/DB), ## Frontend Architecture (real framework/component structure), ## Backend Architecture (real API routes / database layer, or "no backend beyond static rendering" if that's the truth), ## Authentication Architecture (real, or "none" if none detected), ## Deployment Architecture (real provider/status), ## Data Flow, ## Module Interaction (how the real components/pages depend on each other, inferred from imports where visible).`,

  testing: () => `Write the TESTING documentation. Cover: ## Testing Strategy, ## Unit Testing, ## Integration Testing, ## Manual Testing (a practical checklist derived from the real pages/features), ## Known Limitations, ## Edge Cases (grounded in the actual features present), ## Bug Reporting Process. If no test files are visible in the file tree, say so and recommend a concrete, minimal starting setup for this exact stack rather than a generic one.`,

  deployment_guide: (facts) => `Write the DEPLOYMENT GUIDE. Cover, as separate ## sections: Vercel, Netlify, Docker, Self Hosting, Supabase, Environment Variables (the real detected names), Production Checklist. Reflect the REAL current deployment state (${facts.deployments.length ? facts.deployments.map((d) => `${d.provider}: ${d.status}`).join(", ") : "not deployed yet"}) instead of assuming a specific provider was already used unless the facts say so.`,

  readme: () => `Write a professional GitHub README.md. Cover: title + one-line description, ## Features (from real pages/components), ## Screenshots (use clearly marked placeholder image syntax like ![Screenshot](docs/screenshot-1.png) — do not invent real image URLs), ## Installation, ## Usage, ## Configuration (real env vars), ## Folder Structure, ## Contributing, ## License (state "Add your license here" if none is evident), ## Credits. Keep it concise, scannable, and idiomatic GitHub-flavored markdown (badges optional, real tech-stack badges only).`,

  release_notes: (facts) => `Write RELEASE NOTES / a CHANGELOG entry for the CURRENT state of this project, framed as "What's in this version" rather than a fabricated multi-version history (unless the user's existing content already establishes prior versions — in that case add a new entry above them). Summarize real, concrete capabilities present in the file tree (pages, API routes, database, deployment) as bullet points grouped under ## Added / ## Changed / ## Fixed (omit empty groups) plus a ## Notes section for anything worth calling out (e.g. no database connected yet).`,

  ai_explain: () => `(handled separately by buildAiExplainPrompt)`,
  viva_mode: () => `(handled separately by buildVivaModePrompt)`,
};

function buildRegenerationNote(req: SectionRequest): string {
  if (req.mode === "generate" || !req.existingMarkdown) return "";
  if (req.mode === "merge") {
    return `\n\nEXISTING DOCUMENT (contains manual edits you must preserve where still accurate):\n---\n${req.existingMarkdown}\n---\nMERGE MODE: update only the parts that are stale relative to the real project facts above. Preserve the user's manual wording, added sections, and any custom notes wherever they are still accurate. Only rewrite the parts that now contradict the real facts, or that are missing information the facts reveal. Do not silently delete content the user wrote unless it's factually wrong.`;
  }
  return `\n\nPREVIOUS VERSION (for context/continuity only — you may restructure freely if the project has changed):\n---\n${req.existingMarkdown}\n---`;
}

export function buildDocSectionPrompt(facts: ProjectFacts, req: SectionRequest): { system: string; user: string } {
  if (req.key === "ai_explain") return buildAiExplainPrompt(facts, req);
  if (req.key === "viva_mode") return buildVivaModePrompt(facts, req);

  const instructions = SECTION_INSTRUCTIONS[req.key](facts);
  const factsBlock = buildFactsBlock(facts);
  const regen = buildRegenerationNote(req);

  const system = `You are the Documentation Agent of WebdevsAI, generating REAL, accurate project documentation — never placeholder or generic filler content when real information exists in the facts provided.

${factsBlock}
${regen}

TASK:
${instructions}

You MUST respond with valid JSON only, with this exact structure:
{
  "title": "Short human-readable title for this document",
  "content_md": "The FULL document as GitHub-flavored markdown, starting with a single # heading"
}

RULES:
- Ground every specific claim in the facts above. Where the facts don't cover something, say so plainly (e.g. "*Not yet configured*") instead of inventing specifics.
- Use proper markdown: headings, bullet/numbered lists, tables where tabular data helps, fenced code blocks for code/commands.
- Write in clear, professional prose — this is a real deliverable, not a stub.
- Do not include a JSON code fence or any text outside the JSON object.`;

  return { system, user: "Generate the document now." };
}

function buildAiExplainPrompt(facts: ProjectFacts, req: SectionRequest): { system: string; user: string } {
  const audience = req.audience === "viva" ? "viva" : "client";
  const factsBlock = buildFactsBlock(facts);
  const audienceInstructions = audience === "client"
    ? `Write for a CLIENT PRESENTATION: a non-technical stakeholder who paid for this project and wants confidence it works and was built well. Emphasize business value, what was delivered, and why choices were made in terms of outcomes (reliability, speed, cost, security) rather than implementation detail. Keep jargon minimal and always translate it when used.`
    : `Write for a COLLEGE VIVA (oral exam) defense: a student explaining their own project to examiners. Be precise and technical, use correct terminology, and be ready to justify each technology choice academically (why this was an appropriate choice for the stated objectives, what alternatives exist, and trade-offs).`;

  const system = `You are the AI Explain Project assistant of WebdevsAI.

${factsBlock}

TASK: Explain this project for the following audience.
${audienceInstructions}

Cover, as markdown sections: ## How The Project Works (end-to-end, grounded in the real pages/routes), ## How Authentication Works (real, or "this project has no authentication" if none detected), ## Database Design (real schema if connected), ## Business Logic (real, inferred from the actual routes/components), ## Folder Structure (brief, real), ## Why Each Technology Was Selected (ground this in the actual detected stack, e.g. why Next.js App Router, why Supabase, etc. — reasoned justifications, not marketing copy).

You MUST respond with valid JSON only:
{
  "title": "Explain This Project — ${audience === "client" ? "Client Presentation" : "College Viva"}",
  "content_md": "Full markdown explanation"
}
No text outside the JSON object.`;

  return { system, user: "Explain the project now." };
}

function buildVivaModePrompt(facts: ProjectFacts, req: SectionRequest): { system: string; user: string } {
  const levels = req.levels && req.levels.length ? req.levels : (["basic", "intermediate", "advanced"] as VivaLevel[]);
  const factsBlock = buildFactsBlock(facts);

  const system = `You are the Viva Mode assistant of WebdevsAI — you generate a realistic set of college viva (oral exam) interview questions AND expected model answers, based on the REAL project below, so a student can rehearse defending their own work.

${factsBlock}

TASK: Generate interview questions for these categories: ${levels.join(", ")}.
- "basic": what the project does, what technologies were used, simple definitions.
- "intermediate": how specific features/flows work (auth, database, routing), why certain technologies were chosen.
- "advanced": architecture trade-offs, security, scalability, what you'd do differently, edge cases, testing strategy.
Generate 5-8 questions per requested category, each with a concise, correct, defensible expected answer grounded in the real facts above (never invented functionality).

You MUST respond with valid JSON only, with this exact structure:
{
  "title": "Viva Mode — Interview Questions",
  "content_md": "The full Q&A as readable markdown, grouped under ## Basic / ## Intermediate / ## Advanced headings (only the requested categories), each question as a bold line followed by the answer",
  "content_json": {
    "categories": [
      { "level": "basic", "questions": [ { "question": "...", "answer": "..." } ] }
    ]
  }
}
Only include the requested categories (${levels.join(", ")}) in both content_md and content_json. No text outside the JSON object.`;

  return { system, user: "Generate the viva question set now." };
}
