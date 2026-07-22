// path: supabase/functions/provision-database/index.ts
// Database Agent (Phase 3, hardened): wires a REAL Supabase backend into a
// generated project. Reuses the existing "Connect Supabase" account
// connection (supabase_connections) — no separate auth flow.
//
// Two modes:
//   "shared"    — reuse the user's already-selected Supabase project. Tables
//                 are prefixed per-app so multiple generated apps can safely
//                 share one Supabase project. Synchronous — finishes in this
//                 same call.
//   "dedicated" — create a brand-new Supabase project via the Management
//                 API. Provisioning is async on Supabase's side, so this
//                 call only kicks it off and returns status "provisioning".
//                 The frontend then polls check-database-provisioning.
//
// Hardening in this version: race-safe idempotent locking (project_id is
// UNIQUE — a fresh INSERT is the lock; a stuck/failed attempt is reclaimed
// via a conditional UPDATE ... WHERE status='error'), idempotent generated
// SQL (IF NOT EXISTS everywhere, DROP POLICY IF EXISTS before CREATE
// POLICY), automatic rollback of partially-created (prefixed, so safely
// ours) tables on failure, retrying Management API calls on transient
// errors, user-friendly error messages, introspected+typed database.ts
// generation, and a CRUD-completeness check feeding the QA pass.
//
// NOTE: the "finish provisioning" logic (run schema, fetch keys, introspect
// types, rewire the mock data layer to real Supabase queries) is duplicated
// in supabase/functions/check-database-provisioning/index.ts — keep both in
// sync when editing either one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import { validateProject, formatIssues, type ValidationIssue } from "./validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";
const MGMT_API = "https://api.supabase.com/v1";
const PROTECTED_PATHS = ["package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", ".gitignore"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// AI providers (same pattern as generate-app / edit-project)
// ---------------------------------------------------------------------------

class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function generateWithGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error:", response.status, text);
    throw new ProviderError(`Gemini API error: ${response.status}`, response.status);
  }
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("No content in Gemini response");
  return content;
}

async function generateWithClaude(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No content in Claude response");
  return textBlock.text;
}

function parseJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const braceStart = content.indexOf("{");
    const braceEnd = content.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1) return JSON.parse(content.substring(braceStart, braceEnd + 1));
    throw new Error("Could not parse AI response as JSON");
  }
}

async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<any> {
  try {
    const content = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    return parseJSON(content);
  } catch (geminiErr) {
    if (!anthropicKey) throw geminiErr;
    const geminiMessage = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    console.error(`Gemini failed (${geminiMessage}) — falling back to Claude`);
    const content = await generateWithClaude(anthropicKey, systemPrompt, userPrompt);
    return parseJSON(content);
  }
}

// ---------------------------------------------------------------------------
// Error handling: retry transient Management API failures, translate raw
// errors into messages a non-technical user can act on.
// ---------------------------------------------------------------------------

async function mgmtFetch(path: string, token: string, init?: RequestInit, attempt = 1): Promise<any> {
  const MAX_ATTEMPTS = 3;
  let res: Response;
  try {
    res = await fetch(`${MGMT_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch (networkErr) {
    if (attempt < MAX_ATTEMPTS) {
      await sleep(300 * 2 ** (attempt - 1));
      return mgmtFetch(path, token, init, attempt + 1);
    }
    throw new Error(`Network error calling Supabase Management API ${path}: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const transient = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (transient && attempt < MAX_ATTEMPTS) {
      await sleep(400 * 2 ** (attempt - 1));
      return mgmtFetch(path, token, init, attempt + 1);
    }
    throw new Error(`Supabase Management API ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function friendlyError(raw: unknown): { message: string; retryable: boolean } {
  const text = raw instanceof Error ? raw.message : String(raw);
  const lower = text.toLowerCase();
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("invalid api key")) {
    return { message: "Your Supabase connection looks expired or lacks permission. Reconnect it in Settings → Resources and try again.", retryable: false };
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return { message: "Supabase is rate-limiting requests right now. Please wait a moment and try again.", retryable: true };
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("network error") || lower.includes("fetch failed")) {
    return { message: "Couldn't reach Supabase (network issue). Please try again.", retryable: true };
  }
  if (lower.includes("502") || lower.includes("503") || lower.includes("504")) {
    return { message: "Supabase is temporarily unavailable. Please try again in a moment.", retryable: true };
  }
  if (lower.includes("no supabase/schema.sql") || lower.includes("no database schema")) {
    return { message: text, retryable: false };
  }
  if (lower.includes("organization")) {
    return { message: "Couldn't find a Supabase organization on your account to create a project in.", retryable: false };
  }
  const trimmed = text.length > 220 ? `${text.slice(0, 220)}…` : text;
  return { message: `Something went wrong while setting up your database (${trimmed}). Please try again.`, retryable: true };
}

// ---------------------------------------------------------------------------
// Supabase Management API helpers (operate on the user's OWN account via
// their stored Personal Access Token — never our own service role key).
// ---------------------------------------------------------------------------

async function runManagementSql(ref: string, token: string, sql: string): Promise<void> {
  await mgmtFetch(`/projects/${ref}/database/query`, token, { method: "POST", body: JSON.stringify({ query: sql }) });
}

async function fetchAnonKey(ref: string, token: string): Promise<string> {
  const keys = await mgmtFetch(`/projects/${ref}/api-keys`, token);
  const anon = Array.isArray(keys) ? keys.find((k: any) => k.name === "anon") : null;
  if (!anon?.api_key) throw new Error("Could not read the anon API key for this Supabase project.");
  return anon.api_key as string;
}

async function fetchProjectMeta(ref: string, token: string): Promise<any> {
  return mgmtFetch(`/projects/${ref}`, token);
}

function randomDbPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");
  return `${raw.slice(0, 24)}Aa1!`;
}

async function createDedicatedProject(token: string, name: string, orgId: string, region: string): Promise<any> {
  return mgmtFetch(`/projects`, token, {
    method: "POST",
    body: JSON.stringify({ name, organization_id: orgId, region, plan: "free", db_pass: randomDbPassword() }),
  });
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

async function introspectColumns(ref: string, token: string, tables: string[]): Promise<Record<string, ColumnInfo[]>> {
  if (tables.length === 0) return {};
  const list = tables.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ");
  const sql = `select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name in (${list}) order by table_name, ordinal_position;`;
  const result = await mgmtFetch(`/projects/${ref}/database/query`, token, { method: "POST", body: JSON.stringify({ query: sql }) });
  const rows: any[] = Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
  const byTable: Record<string, ColumnInfo[]> = {};
  for (const row of rows) {
    const t = row.table_name;
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable === "YES" });
  }
  return byTable;
}

// ---------------------------------------------------------------------------
// Schema table-prefixing + idempotency — keeps multiple generated apps
// collision-free inside one shared Supabase project, and makes re-running
// the exact same schema safe (no duplicate-object errors).
// ---------------------------------------------------------------------------

function extractTableNames(sql: string): string[] {
  const names = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) names.add(m[1]);
  return [...names];
}

function prefixSchemaSql(sql: string, prefix: string): { sql: string; tables: string[] } {
  const names = extractTableNames(sql).sort((a, b) => b.length - a.length);
  let out = sql;
  const tables: string[] = [];
  for (const name of names) {
    const newName = `${prefix}${name}`;
    tables.push(newName);
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), newName);
  }
  // Index names are NOT prefixed by the table-name replace above: an index like
  // "todos_user_id_idx" has no word boundary between "todos" and the trailing
  // "_user_id_idx" (underscore is a word character), so it would slip through
  // unrenamed and could collide with another app's index of the same name in a
  // shared project. Postgres index names are unique per-schema (not per-table),
  // so this must be prefixed explicitly.
  out = out.replace(
    /(create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?)([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    (match, lead, idxName) => (idxName.startsWith(prefix) ? match : `${lead}${prefix}${idxName}`),
  );
  // Safety net: force RLS on even if the AI-generated schema forgot it for a table.
  const rlsGuard = tables.map((t) => `alter table if exists public."${t}" enable row level security;`).join("\n");
  return { sql: `${out}\n\n-- WebdevsAI safety net: RLS is always forced on.\n${rlsGuard}\n`, tables };
}

/** Rewrites CREATE TABLE / CREATE INDEX to IF NOT EXISTS and prefixes every CREATE POLICY with a matching DROP POLICY IF EXISTS, so re-running the exact same schema (retry, double-click) never fails on "already exists". */
function idempotentizeSql(sql: string): string {
  let out = sql;
  out = out.replace(/create\s+table\s+(?!if\s+not\s+exists)/gi, "create table if not exists ");
  out = out.replace(/create\s+(unique\s+)?index\s+(?!if\s+not\s+exists)/gi, (_m, uniq) => `create ${uniq || ""}index if not exists `);
  out = out.replace(
    /create\s+policy\s+("(?:[^"]|"")*"|[a-zA-Z_][a-zA-Z0-9_]*)\s+on\s+((?:public\.)?"?[a-zA-Z_][a-zA-Z0-9_]*"?)/gi,
    (match, policyName, tableName) => `drop policy if exists ${policyName} on ${tableName};\n${match}`,
  );
  return out;
}

async function rollbackTables(ref: string, token: string, tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  const dropSql = `drop table if exists ${tables.map((t) => `public."${t}"`).join(", ")} cascade;`;
  try {
    await mgmtFetch(`/projects/${ref}/database/query`, token, { method: "POST", body: JSON.stringify({ query: dropSql }) });
  } catch (e) {
    console.error("Rollback of partially-created tables failed — manual cleanup may be needed in the Supabase dashboard:", e);
  }
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6);
}

function computeTablePrefix(projectId: string, plan: any): string {
  const category = String(plan?.legacy_type || plan?.project_type || "app").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "app";
  return `${category}_${shortId(projectId)}_`;
}

// ---------------------------------------------------------------------------
// Typed database.ts generation from the ACTUAL applied schema (introspected,
// not guessed from the SQL text) — no `any` in generated code.
// ---------------------------------------------------------------------------

function pgTypeToTs(pgType: string): string {
  const t = pgType.toLowerCase();
  if (["uuid", "text", "character varying", "varchar", "char", "character", "citext"].some((x) => t.includes(x))) return "string";
  if (["integer", "bigint", "smallint", "numeric", "real", "double precision", "decimal"].some((x) => t.includes(x))) return "number";
  if (t === "boolean") return "boolean";
  if (t.includes("timestamp") || t === "date" || t.includes("time")) return "string";
  if (t.includes("json")) return "Json";
  if (t.endsWith("[]") || t.includes("array")) return "unknown[]";
  return "unknown";
}

function pascalCase(name: string): string {
  return name.replace(/(^|_)([a-z0-9])/g, (_m, _sep, c) => c.toUpperCase());
}

function generateDatabaseTypesFile(tables: string[], columnsByTable: Record<string, ColumnInfo[]>, schemaVersion: number): string {
  const blocks = tables.map((table) => {
    const cols = columnsByTable[table] || [];
    const iface = pascalCase(table);
    const rowFields = cols.map((c) => `  ${c.name}: ${pgTypeToTs(c.type)}${c.nullable ? " | null" : ""};`).join("\n");
    const insertFields = cols.map((c) => `  ${c.name}${c.nullable ? "?" : ""}: ${pgTypeToTs(c.type)}${c.nullable ? " | null" : ""};`).join("\n");
    return `export interface ${iface}Row {\n${rowFields || "  [key: string]: unknown;"}\n}\n\nexport interface ${iface}Insert {\n${insertFields || "  [key: string]: unknown;"}\n}\n\nexport type ${iface}Update = Partial<${iface}Insert>;\n`;
  });
  return `// path: types/database.ts
// Auto-generated from the applied Supabase schema (schema_version ${schemaVersion}). Regenerated
// the next time this project's database is (re)provisioned — avoid hand-editing.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

${blocks.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Rewire the mock data layer (lib/data.ts) to real Supabase queries, and a
// static completeness check so no CRUD function ships as a placeholder.
// ---------------------------------------------------------------------------

function findDataConsumers(files: Record<string, string>): string[] {
  const consumers: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (path === "lib/data.ts" || typeof content !== "string") continue;
    if (!/\.(ts|tsx)$/.test(path)) continue;
    if (/from\s+["']@\/lib\/data["']/.test(content)) consumers.push(path);
  }
  return consumers.slice(0, 10);
}

async function rewireDataLayer(
  files: Record<string, string>,
  appliedSchemaSql: string,
  tables: string[],
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<{ files: Record<string, string>; rewired: boolean }> {
  const currentDataTs = files["lib/data.ts"];
  if (!currentDataTs) return { files, rewired: false };

  const consumerPaths = findDataConsumers(files);
  const consumerDump = consumerPaths.map((p) => `--- FILE: ${p} ---\n${files[p]}`).join("\n\n");
  const hasTypesFile = !!files["types/database.ts"];

  const systemPrompt = `You are the Database Agent of WebdevsAI. A REAL Postgres database has just been provisioned on Supabase for this project and the schema below has been applied for real. Your ONLY job is to rewrite lib/data.ts so it reads and writes this real database via the Supabase client, instead of in-memory mock/sample data — and to fix any other file that calls it in a way that no longer works (e.g. treating an async call as synchronous).

APPLIED SCHEMA (table names are final — use these EXACT names, do not invent columns/tables not listed here):
${appliedSchemaSql}

CURRENT lib/data.ts (mock implementation):
${currentDataTs}

A configured Supabase client is available at "@/lib/supabase", exporting \`supabase\`. Import it as: import { supabase } from "@/lib/supabase";
${hasTypesFile ? `Strongly-typed row interfaces for every table are already generated at "@/types/database" (e.g. import type { ${pascalCase(tables[0] || "table")}Row } from "@/types/database";). Use them for every function's parameter and return types — NEVER use "any".` : ""}

${consumerPaths.length > 0 ? `FILES THAT IMPORT FROM lib/data.ts (fix call sites here only if the new async lib/data.ts requires it):\n${consumerDump}` : ""}

Rules — every exported function must be a REAL, complete implementation (no TODO, no "not implemented", no placeholders):
- Keep the exact same exported function names from lib/data.ts so unrelated files keep compiling.
- All functions must be async and query the real tables via supabase.from("<exact_table_name>")...
- Provide full CRUD: create (insert), read (both a list function and a get-by-id function), update, and delete.
- The list function must support search (ilike on the obvious text column(s)), pagination (page/pageSize using .range()), and sorting (sortBy/sortDir using .order()) — with sensible defaults so existing callers that pass no options keep working.
- Throw a descriptive Error when a Supabase query returns an error (check the 'error' field on every call).
- Never use the TypeScript "any" type — use the generated row types (or derive precise types) everywhere.
- Only touch files that truly need it. Do not rewrite files unrelated to this data layer.
- Never touch package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.

Respond with valid JSON only: { "files": { "lib/data.ts": "FULL new file content", "...other fixed file...": "FULL new file content" } }`;

  const parsed = await generateContent(systemPrompt, "Rewire the data layer now.", geminiKey, anthropicKey);
  const next = { ...files };
  let rewired = false;
  if (parsed?.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const [path, content] of Object.entries(parsed.files)) {
      const normalized = String(path).replace(/^\/+/, "");
      if (PROTECTED_PATHS.includes(normalized)) continue;
      if (typeof content === "string" && content.length > 0) {
        next[normalized] = content;
        rewired = true;
      }
    }
  }
  return { files: next, rewired };
}

/**
 * When a project has no supabase/schema.sql — because the AI planner didn't
 * originally flag it as needing a database — infers a reasonable schema (and
 * a real lib/data.ts + updated consumer files) from the project's EXISTING
 * UI/components, so "Add Database" works on any generated app, not only the
 * ones the planner happened to flag up front.
 */
async function synthesizeDataLayer(
  files: Record<string, string>,
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<{ files: Record<string, string> }> {
  const relevantPaths = Object.keys(files).filter((p) =>
    /\.(ts|tsx)$/.test(p) &&
    (p.startsWith("app/") || p.startsWith("components/") || p.startsWith("lib/") || p.startsWith("types/")) &&
    !p.startsWith("components/ui/"),
  );
  const dump = relevantPaths.map((p) => `--- FILE: ${p} ---\n${files[p]}`).join("\n\n").slice(0, 60000);

  const systemPrompt = `You are the Database Agent of WebdevsAI. This app was originally generated WITHOUT a database — whatever list(s) of records it shows are hardcoded sample data baked directly into its components or page files (no lib/data.ts exists yet). The user has now asked to add a real, persisted Supabase database so the data survives reloads and is shared across sessions.

PROJECT FILES (TypeScript/TSX only, UI primitives omitted):
${dump}

Your job:
1. Identify the core entity/entities this app manages from its actual UI and hardcoded sample data (e.g. a contacts list, tasks, bookings — infer this from the code, don't guess generically).
2. Design a minimal, correct "supabase/schema.sql": CREATE TABLE statement(s) with sensible columns/types matching the fields already used in the UI, "id uuid primary key default gen_random_uuid()", "created_at timestamptz not null default now()", and RLS enabled with a permissive policy (this app has no per-user auth, so allow all operations to anon/authenticated).
3. Write a complete "lib/data.ts": real, async, fully-typed CRUD functions (list with search/pagination/sort, get-by-id, create, update, delete) querying the table(s) via a Supabase client imported as \`import { supabase } from "@/lib/supabase";\`. Use the EXACT table name(s) from your schema.sql.
4. Rewrite every component/page file that currently holds the hardcoded sample array so it instead calls the new lib/data.ts functions (adding "use client" + useEffect/useState where needed, or fetching in a Server Component — match however the file already renders).

Rules:
- Every exported lib/data.ts function must be a complete, real implementation — no TODO, no placeholders.
- Never use the TypeScript "any" type.
- Only touch files that truly need it to wire up real data. Do not redesign the UI or change functionality otherwise.
- Never touch package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.

Respond with valid JSON only: { "schema_sql": "FULL contents of supabase/schema.sql", "files": { "lib/data.ts": "FULL new file content", "...other rewritten file...": "FULL new file content" } }`;

  const parsed = await generateContent(systemPrompt, "Design the schema and wire the app to it now.", geminiKey, anthropicKey);
  if (!parsed?.schema_sql || typeof parsed.schema_sql !== "string" || !parsed.schema_sql.trim()) {
    throw new Error("Couldn't figure out a database schema for this app's data — try asking the AI in the editor to describe what should be persisted, then try again.");
  }
  const next = { ...files, "supabase/schema.sql": parsed.schema_sql as string };
  if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const [path, content] of Object.entries(parsed.files)) {
      const normalized = String(path).replace(/^\/+/, "");
      if (PROTECTED_PATHS.includes(normalized)) continue;
      if (typeof content === "string" && content.length > 0) next[normalized] = content;
    }
  }
  if (!next["lib/data.ts"]) {
    throw new Error("Couldn't generate a data layer for this app's records.");
  }
  return { files: next };
}

function checkCrudCompleteness(dataTs: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (/\btodo\b|not implemented|placeholder/i.test(dataTs)) {
    issues.push({ file: "lib/data.ts", issue: "Contains a TODO/placeholder/not-implemented marker — every exported function must be a real, working implementation." });
  }
  const lower = dataTs.toLowerCase();
  const ops: [string, string][] = [[".insert(", "create"], [".update(", "update"], [".delete(", "delete"]];
  for (const [needle, label] of ops) {
    if (!lower.includes(needle)) issues.push({ file: "lib/data.ts", issue: `No ${label} operation found — add a real ${label} function using supabase${needle}...` });
  }
  if (!lower.includes(".select(")) issues.push({ file: "lib/data.ts", issue: "No read/select operation found — add real list and get-by-id functions." });
  if (!/\.order\(|\.range\(/.test(lower)) {
    issues.push({ file: "lib/data.ts", issue: "The list function is missing sorting/pagination — add .order() for sortBy/sortDir and .range() for page/pageSize." });
  }
  if (/:\s*any\b/.test(dataTs)) {
    issues.push({ file: "lib/data.ts", issue: 'Uses the "any" type — replace with the generated row types from "@/types/database" (or precise inline types).' });
  }
  return issues;
}

async function runQaFix(
  files: Record<string, string>,
  issues: ValidationIssue[],
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<Record<string, string>> {
  const affected = new Set(issues.map((i) => i.file));
  affected.add("app/page.tsx");
  const affectedDump = [...affected].filter((p) => files[p] !== undefined).map((p) => `--- FILE: ${p} ---\n${files[p]}`).join("\n\n");
  const fileList = Object.keys(files).sort().join("\n");
  const systemPrompt = `You are the QA Agent of WebdevsAI, cleaning up after a database was wired in. Fix ONLY these problems — change nothing else.

PROJECT FILE TREE:
${fileList}

PROBLEMS TO FIX:
${formatIssues(issues)}

RELEVANT FILE CONTENTS:
${affectedDump}

Respond with valid JSON only: { "files": { "path": "FULL corrected file content" } }
Never touch package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.`;
  const parsed = await generateContent(systemPrompt, "Fix the listed problems now.", geminiKey, anthropicKey);
  const fixes: Record<string, string> = {};
  if (parsed?.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const [path, content] of Object.entries(parsed.files)) {
      const normalized = String(path).replace(/^\/+/, "");
      if (PROTECTED_PATHS.includes(normalized)) continue;
      if (typeof content === "string" && content.length > 0) fixes[normalized] = content;
    }
  }
  return fixes;
}

// ---------------------------------------------------------------------------
// Row helpers + failure bookkeeping
// ---------------------------------------------------------------------------

function pickDb(row: any): any {
  if (!row) return null;
  return {
    mode: row.mode, provider: row.provider, project_ref: row.project_ref,
    project_url: row.project_url, table_prefix: row.table_prefix, tables: row.tables,
  };
}

async function markError(admin: ReturnType<typeof createClient>, projectId: string, message: string): Promise<void> {
  const { error } = await admin.from("project_databases").update({ status: "error", error_message: message, updated_at: new Date().toISOString() }).eq("project_id", projectId);
  if (error) console.error("Failed to mark project_databases row as error:", error.message);
}

// ---------------------------------------------------------------------------
// Shared "finish provisioning" logic — runs the (prefixed, idempotent)
// schema against an ACTIVE Supabase project, fetches credentials,
// introspects real types, rewires the data layer, and persists everything.
// On failure, rolls back any tables it created and marks the row as
// "error" itself (callers just need to turn the thrown error into a
// response) — a run is NEVER left stuck in "provisioning".
// ---------------------------------------------------------------------------

async function finishProvisioning(opts: {
  admin: ReturnType<typeof createClient>;
  projectId: string;
  ref: string;
  accessToken: string;
  files: Record<string, string>;
  plan: any;
  mode: "shared" | "dedicated";
  tablePrefix: string;
  geminiKey: string;
  anthropicKey: string | undefined;
}): Promise<any> {
  const { admin, projectId, ref, accessToken, mode, tablePrefix, geminiKey, anthropicKey } = opts;
  let files = { ...opts.files };

  let rawSchema = files["supabase/schema.sql"];
  if (!rawSchema) {
    try {
      const synthesized = await synthesizeDataLayer(files, geminiKey, anthropicKey);
      files = synthesized.files;
      rawSchema = files["supabase/schema.sql"];
    } catch (synthErr) {
      const message = synthErr instanceof Error ? synthErr.message : "Couldn't design a database schema for this app.";
      await markError(admin, projectId, message);
      throw new Error(message);
    }
  }

  const { sql: prefixedSql, tables } = prefixSchemaSql(rawSchema, tablePrefix);
  const idempotentSql = idempotentizeSql(prefixedSql);

  try {
    await runManagementSql(ref, accessToken, idempotentSql);
  } catch (schemaErr) {
    await rollbackTables(ref, accessToken, tables);
    const friendly = friendlyError(schemaErr);
    await markError(admin, projectId, friendly.message);
    throw new Error(friendly.message);
  }

  let anonKey: string;
  let projectUrl: string;
  try {
    anonKey = await fetchAnonKey(ref, accessToken);
    projectUrl = `https://${ref}.supabase.co`;
  } catch (keyErr) {
    await rollbackTables(ref, accessToken, tables);
    const friendly = friendlyError(keyErr);
    await markError(admin, projectId, friendly.message);
    throw new Error(friendly.message);
  }

  let columnsByTable: Record<string, ColumnInfo[]> = {};
  try {
    columnsByTable = await introspectColumns(ref, accessToken, tables);
  } catch (introspectErr) {
    console.error("Column introspection failed (generated types will be minimal):", introspectErr);
  }

  files["supabase/schema.sql"] = idempotentSql;
  files["types/database.ts"] = generateDatabaseTypesFile(tables, columnsByTable, 1);
  files["lib/supabase.ts"] = `// path: lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;
  files[".env.local"] = `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}\n`;

  let rewired = false;
  try {
    const result = await rewireDataLayer(files, idempotentSql, tables, geminiKey, anthropicKey);
    files = result.files;
    rewired = result.rewired;
  } catch (rewireErr) {
    console.error("Data layer rewire failed (database is live, code stays on mock data):", rewireErr);
  }

  let validation = validateProject(files);
  files = validation.files;
  const crudIssues = files["lib/data.ts"] ? checkCrudCompleteness(files["lib/data.ts"]) : [];
  const allIssues = [...validation.issues, ...crudIssues];
  const qaReport = { issues_found: allIssues.length, auto_fixes: validation.autoFixes, ai_fixed: 0, remaining: [] as ValidationIssue[] };

  if (allIssues.length > 0) {
    try {
      const fixes = await runQaFix(files, allIssues, geminiKey, anthropicKey);
      if (Object.keys(fixes).length > 0) {
        files = { ...files, ...fixes };
        const revalidation = validateProject(files);
        files = revalidation.files;
        const remainingCrud = files["lib/data.ts"] ? checkCrudCompleteness(files["lib/data.ts"]) : [];
        qaReport.ai_fixed = allIssues.length - (revalidation.issues.length + remainingCrud.length);
        qaReport.remaining = [...revalidation.issues, ...remainingCrud];
        qaReport.auto_fixes = [...qaReport.auto_fixes, ...revalidation.autoFixes];
      } else {
        qaReport.remaining = allIssues;
      }
    } catch (qaErr) {
      console.error("QA fix round failed:", qaErr);
      qaReport.remaining = allIssues;
    }
  }

  const { error: updateProjectErr } = await admin.from("projects").update({ files, updated_at: new Date().toISOString() }).eq("id", projectId);
  if (updateProjectErr) console.error("Failed to persist rewired files:", updateProjectErr.message);

  const nowIso = new Date().toISOString();
  const migrationEntry = { version: 1, applied_at: nowIso, description: `Initial schema applied (${mode} mode, ${tables.length} table${tables.length === 1 ? "" : "s"})` };
  const dbRow = {
    project_id: projectId,
    provider: "supabase",
    mode,
    project_ref: ref,
    project_url: projectUrl,
    anon_key: anonKey,
    table_prefix: tablePrefix,
    tables,
    status: "ready",
    error_message: null,
    schema_version: 1,
    migration_history: [migrationEntry],
    locked_at: null,
    updated_at: nowIso,
  };
  const { error: upsertErr } = await admin.from("project_databases").upsert(dbRow, { onConflict: "project_id" });
  if (upsertErr) console.error("Failed to persist project_databases row:", upsertErr.message);

  return {
    status: "ready",
    database: { mode, provider: "supabase", project_ref: ref, project_url: projectUrl, table_prefix: tablePrefix, tables },
    files,
    changed_paths: ["supabase/schema.sql", "types/database.ts", "lib/supabase.ts", ".env.local", ...(rewired ? ["lib/data.ts"] : [])],
    data_layer_rewired: rewired,
    qa: qaReport,
  };
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { project_id, mode } = await req.json();
    if (!project_id || typeof project_id !== "string") return json({ error: "project_id is required" }, 400);
    if (mode !== "shared" && mode !== "dedicated") return json({ error: 'mode must be "shared" or "dedicated"' }, 400);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: project, error: projectError } = await admin.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single();
    if (projectError || !project) return json({ error: "Project not found" }, 404);
    if (!project.files || typeof project.files !== "object" || Object.keys(project.files).length === 0) {
      return json({ error: "This project doesn't have a modern (Next.js) file map to provision a database into." }, 400);
    }
    // No supabase/schema.sql yet (e.g. the planner didn't flag this project as needing a
    // database up front) is no longer a hard stop — finishProvisioning() synthesizes one
    // from the project's existing UI/components before applying it.

    // --- Idempotency: short-circuit if already finished or already in flight (any mode). ---
    const { data: existing } = await admin.from("project_databases").select("*").eq("project_id", project_id).maybeSingle();
    if (existing?.status === "ready") return json({ status: "ready", database: pickDb(existing) });
    if (existing?.status === "provisioning") return json({ status: "provisioning", database: pickDb(existing) });

    // --- Connection check happens BEFORE we ever touch project_databases, so a
    // missing connection never leaves a stuck lock behind. ---
    const { data: connection } = await admin.from("supabase_connections").select("access_token, project_ref").eq("user_id", user.id).maybeSingle();
    if (!connection?.access_token) {
      return json({ error: "NOT_CONNECTED", message: "Connect your Supabase account first (Settings → Resources), then try again." }, 400);
    }
    if (mode === "shared" && !connection.project_ref) {
      return json({ error: "NO_PROJECT_SELECTED", message: "Pick a Supabase project in Settings → Resources first." }, 400);
    }

    const tablePrefix = computeTablePrefix(project_id, project.plan);
    const nowIso = new Date().toISOString();

    // --- Acquire the lock: project_id is UNIQUE, so a fresh INSERT is an
    // atomic lock; a previously-failed attempt is reclaimed with a
    // conditional UPDATE. Either way, a concurrent duplicate request loses
    // the race and is told to just watch the in-flight attempt instead of
    // starting a second one. ---
    if (!existing) {
      const { error: insertErr } = await admin.from("project_databases").insert({
        project_id, provider: "supabase", mode, project_ref: mode === "shared" ? connection.project_ref : null,
        project_url: null, anon_key: null, table_prefix: tablePrefix, tables: [], status: "provisioning",
        error_message: null, locked_at: nowIso, updated_at: nowIso,
      });
      if (insertErr) {
        if (insertErr.code === "23505") {
          const { data: raced } = await admin.from("project_databases").select("*").eq("project_id", project_id).maybeSingle();
          return json({ status: raced?.status ?? "provisioning", database: pickDb(raced) });
        }
        throw insertErr;
      }
    } else {
      // existing.status === "error" — reclaim it for a retry.
      const { data: updated, error: updateErr } = await admin.from("project_databases")
        .update({ mode, project_ref: mode === "shared" ? connection.project_ref : null, error_message: null, status: "provisioning", locked_at: nowIso, updated_at: nowIso })
        .eq("project_id", project_id).eq("status", "error").select();
      if (updateErr) throw updateErr;
      if (!updated || updated.length === 0) {
        const { data: raced } = await admin.from("project_databases").select("*").eq("project_id", project_id).maybeSingle();
        return json({ status: raced?.status ?? "provisioning", database: pickDb(raced) });
      }
    }

    if (mode === "shared") {
      try {
        const result = await finishProvisioning({
          admin, projectId: project_id, ref: connection.project_ref!, accessToken: connection.access_token,
          files: project.files as Record<string, string>, plan: project.plan, mode: "shared", tablePrefix,
          geminiKey: GEMINI_API_KEY, anthropicKey: ANTHROPIC_API_KEY,
        });
        return json(result);
      } catch (err) {
        // finishProvisioning already rolled back tables + marked the row as "error".
        return json({ error: err instanceof Error ? err.message : "Failed to provision the database" }, 502);
      }
    }

    // --- dedicated mode: kick off project creation, finish later via polling ---
    let orgId: string | undefined;
    let region = "us-east-1";
    if (connection.project_ref) {
      try {
        const meta = await fetchProjectMeta(connection.project_ref, connection.access_token);
        orgId = meta?.organization_id;
        if (meta?.region) region = meta.region;
      } catch (e) {
        console.error("Could not read existing project meta, falling back to org list:", e);
      }
    }
    if (!orgId) {
      try {
        const orgs = await mgmtFetch(`/organizations`, connection.access_token);
        orgId = Array.isArray(orgs) && orgs.length > 0 ? orgs[0].id : undefined;
      } catch (e) {
        const friendly = friendlyError(e);
        await markError(admin, project_id, friendly.message);
        return json({ error: friendly.message }, 502);
      }
    }
    if (!orgId) {
      const message = "Couldn't find a Supabase organization on your account to create a project in.";
      await markError(admin, project_id, message);
      return json({ error: message }, 400);
    }

    const name = `webdevsai-${(project.slug || project_id).toString().slice(0, 30)}`;
    let created;
    try {
      created = await createDedicatedProject(connection.access_token, name, orgId, region);
    } catch (e) {
      const friendly = friendlyError(e);
      await markError(admin, project_id, friendly.message);
      return json({ error: friendly.message }, 502);
    }

    const ref = created?.id;
    if (!ref) {
      const message = "Supabase did not return a project reference.";
      await markError(admin, project_id, message);
      return json({ error: message }, 502);
    }

    const { error: refUpdateErr } = await admin.from("project_databases")
      .update({ project_ref: ref, locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("project_id", project_id);
    if (refUpdateErr) console.error("Failed to record the created project ref:", refUpdateErr.message);

    return json({ status: "provisioning", database: { mode: "dedicated", provider: "supabase", project_ref: ref, project_url: null, table_prefix: tablePrefix, tables: [] } });
  } catch (e) {
    console.error("provision-database error:", e);
    const friendly = friendlyError(e);
    return json({ error: friendly.message }, 500);
  }
});
