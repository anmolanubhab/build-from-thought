// path: supabase/functions/edit-project/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import { validateProject, formatIssues, type ValidationIssue } from "./validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";

// Config files the editor must never touch — they're owned by the scaffold.
const PROTECTED_PATHS = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  ".gitignore",
]);

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
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
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
    max_tokens: 32000,
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
    if (braceStart !== -1 && braceEnd !== -1) {
      return JSON.parse(content.substring(braceStart, braceEnd + 1));
    }
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
    return parseJSON(await generateWithGemini(geminiKey, systemPrompt, userPrompt));
  } catch (geminiErr) {
    const geminiMessage = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    if (!anthropicKey) throw geminiErr;
    console.error(`Gemini failed (${geminiMessage}) — falling back to Claude`);
    try {
      return parseJSON(await generateWithClaude(anthropicKey, systemPrompt, userPrompt));
    } catch (claudeErr) {
      const claudeMessage = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
      const status = geminiErr instanceof ProviderError && geminiErr.status === 429 ? 429 : 502;
      throw new ProviderError(
        `Gemini failed (${geminiMessage}) and Claude fallback also failed (${claudeMessage})`,
        status,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Analyzer Agent (Phase 2): for large projects, decide which files the edit
// actually touches before sending contents — codebase-aware, token-efficient.
// ---------------------------------------------------------------------------

const ANALYZE_THRESHOLD_CHARS = 60_000;
const ANALYZE_THRESHOLD_FILES = 9;

function analyzerSystemPrompt(files: Record<string, string>, plan: any): string {
  // A compact project map: path + imports + first line of each file.
  const map = Object.entries(files)
    .map(([path, content]) => {
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]).slice(0, 12);
      const isClient = /^\s*["']use client["']/.test(content);
      return `${path}${isClient ? " [client]" : ""} — imports: ${imports.join(", ") || "none"}`;
    })
    .join("\n");

  return `You are the Analyzer Agent of WebdevsAI. Before editing an existing Next.js 15 (App Router) repository, you determine which files a change request actually affects. Never select unrelated files.

PROJECT MAP (path [client?] — imports):
${map}
${plan ? `\nPROJECT CONTEXT (original execution plan):\nType: ${plan.project_type || "?"} · Design: ${plan.design ? `${plan.design.mode || ""} ${plan.design.style || ""}` : "?"}\nUnderstanding: ${plan.understanding || ""}` : ""}

You MUST respond with valid JSON only:
{
  "relevant_files": ["components/navbar.tsx", "app/globals.css"],
  "may_create": ["components/new-thing.tsx"],
  "reason": "one sentence"
}

Rules:
- relevant_files: existing files that must be read/modified for this request (smallest sufficient set, max 10).
- may_create: new file paths the change will likely need (often empty).
- A style/theme change usually means the specific component file(s); a global color change means app/globals.css.
- Never include package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.`;
}

// ---------------------------------------------------------------------------

function modernEditSystemPrompt(files: Record<string, string>, mode: string, plan: any, scopedPaths?: string[]): string {
  const fileList = Object.keys(files).sort().join("\n");
  const dumpEntries = scopedPaths
    ? Object.entries(files).filter(([path]) => scopedPaths.includes(path) && !PROTECTED_PATHS.has(path))
    : Object.entries(files).filter(([path]) => !PROTECTED_PATHS.has(path));
  const fileDump = dumpEntries
    .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
    .join("\n\n");
  const contextBlock = plan
    ? `\nPROJECT CONTEXT (original execution plan — preserve this direction):\nType: ${plan.project_type || "?"} · Complexity: ${plan.complexity || "?"}\nUnderstanding: ${plan.understanding || ""}\nDesign: ${plan.design ? `${plan.design.mode || ""} mode · ${plan.design.style || ""} · ${plan.design.accent || ""}` : "?"}\n`
    : "";

  return `You are a senior software engineer editing an EXISTING Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 repository. You behave like an experienced engineer working in a real codebase: analyze first, then change ONLY what the request requires.

PROJECT FILE TREE:
${fileList}
${contextBlock}
${scopedPaths ? "FILE CONTENTS (scoped by the Analyzer Agent to the files relevant to this request — other files exist per the tree above; do not modify them)" : "FILE CONTENTS (config files omitted — never modify package.json, tsconfig.json, next.config.ts, postcss.config.mjs, .gitignore)"}:
${fileDump}

${mode === "suggestion" ? "The user wants a PROPOSAL: describe what you would change and provide the updated files." : "Apply the requested change directly."}

You MUST respond with valid JSON only, with this exact structure:
{
  "summary": "One-sentence description of the change",
  "changes": ["Specific change 1", "Specific change 2"],
  "files": {
    "components/hero.tsx": "FULL updated content of ONLY the files you changed or created"
  },
  "deleted_files": [],
  "preview_html": "Updated self-contained static HTML approximation of the home page (body innerHTML only, no scripts)",
  "preview_css": "Updated plain CSS for preview_html (NO Tailwind — the preview iframe has no build step)"
}

STRICT ENGINEERING RULES:
- "files" contains ONLY files that actually change (or new files). Do NOT re-send unchanged files. Never rewrite unrelated files.
- Return the FULL content of each changed file, not a diff.
- Preserve the existing architecture, naming, component structure, and coding style exactly.
- Keep components small and in their own files; create a new component file rather than bloating an existing one.
- Server Components by default; "use client" only where hooks/events/browser APIs are used.
- Use the existing design tokens (bg-background, text-foreground, bg-primary, text-muted-foreground, border-border, etc.) and existing ui primitives from components/ui/.
- Only import packages already imported somewhere in the project, plus lucide-react.
- Maintain accessibility (semantic HTML, aria-labels, focus states) and responsiveness.
- "deleted_files" lists paths that should be removed (rarely needed — only when the request demands it). Never delete config files.
- Update preview_html/preview_css so the static preview matches the changed app. If the change doesn't affect the home page's appearance, return the previous preview unchanged.
- No obvious runtime errors, no missing imports, no unused code. Mentally verify TypeScript would compile before answering.`;
}

function legacyEditSystemPrompt(currentHtml: string, currentCss: string, currentReactCode: string, mode: string): string {
  return `You are an expert web developer AI assistant. You are editing an existing web project.

Current project code:
--- HTML ---
${currentHtml || "<div></div>"}
--- CSS ---
${currentCss || ""}
--- React Code ---
${currentReactCode || ""}

The user wants to make changes. ${mode === "suggestion" ? "Provide a description of what you would change, then the updated code." : "Apply the changes directly."}

You MUST respond with valid JSON only. The JSON must have this exact structure:
{
  "summary": "Brief description of changes made",
  "html": "Updated complete HTML content (body inner HTML only)",
  "css": "Updated complete CSS styles",
  "react_code": "Updated complete React component code",
  "changes": ["List of specific changes made"]
}

Rules:
- Preserve existing functionality unless explicitly asked to change it
- Make the requested modifications cleanly
- Keep the design professional and responsive
- Do NOT include script tags in HTML
- Do NOT include import statements in HTML
- Return the FULL updated code, not just the diff`;
}

// ---------------------------------------------------------------------------
// QA Agent (Phase 2): fixes issues the deterministic validator found post-edit.
// ---------------------------------------------------------------------------

async function runQaFix(
  files: Record<string, string>,
  issues: ValidationIssue[],
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<Record<string, string>> {
  const affected = new Set(issues.map((i) => i.file));
  affected.add("app/page.tsx");
  const affectedDump = [...affected]
    .filter((p) => files[p] !== undefined)
    .map((p) => `--- FILE: ${p} ---\n${files[p]}`)
    .join("\n\n");
  const fileList = Object.keys(files).sort().join("\n");

  const systemPrompt = `You are the QA Agent of WebdevsAI. A deterministic validator found concrete problems after an edit to a Next.js 15 + TypeScript + Tailwind v4 project. Fix ONLY these problems — change nothing else.

PROJECT FILE TREE:
${fileList}

PROBLEMS TO FIX:
${formatIssues(issues)}

RELEVANT FILE CONTENTS:
${affectedDump}

You MUST respond with valid JSON only:
{
  "files": { "path/of/fixed/or/new/file.tsx": "FULL corrected file content" }
}

Rules:
- Return ONLY files you fixed or created. Full contents, not diffs.
- Missing "use client": add the directive as the very first line.
- Unresolved import of a missing file: CREATE that file with a sensible, complete implementation matching how it is used.
- Broken route link: create the route page or point the link at an existing route — whichever the code implies.
- Unavailable package: rewrite the importing code using available packages or plain React/Tailwind.
- Never touch package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.`;

  const parsed = await generateContent(systemPrompt, "Fix the listed problems now.", geminiKey, anthropicKey);
  const fixes: Record<string, string> = {};
  if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const [path, content] of Object.entries(parsed.files)) {
      const normalized = String(path).replace(/^\/+/, "");
      if (PROTECTED_PATHS.has(normalized)) continue;
      if (typeof content === "string" && content.length > 0) fixes[normalized] = content;
    }
  }
  return fixes;
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, currentHtml, currentCss, currentReactCode, files, mode, plan } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const applyMode = mode === "suggest" ? "suggestion" : "direct";
    const isModern = files && typeof files === "object" && !Array.isArray(files) && Object.keys(files).length > 0;

    // =====================================================================
    // Modern file-aware editing (Phase 2: analyze → edit → validate)
    // =====================================================================
    if (isModern) {
      const projectPlan = plan && typeof plan === "object" ? plan : null;

      // --- Analyzer stage: scope large projects to the relevant files only ---
      let scopedPaths: string[] | undefined;
      const totalChars = Object.values(files as Record<string, string>).reduce(
        (sum: number, c) => sum + (typeof c === "string" ? c.length : 0),
        0,
      );
      if (totalChars > ANALYZE_THRESHOLD_CHARS && Object.keys(files).length > ANALYZE_THRESHOLD_FILES) {
        try {
          const analysis = await generateContent(
            analyzerSystemPrompt(files, projectPlan),
            prompt.trim(),
            GEMINI_API_KEY,
            ANTHROPIC_API_KEY,
          );
          const relevant: string[] = Array.isArray(analysis.relevant_files)
            ? analysis.relevant_files.filter((p: unknown) => typeof p === "string" && (files as any)[p] !== undefined)
            : [];
          if (relevant.length > 0 && relevant.length <= 12) {
            scopedPaths = relevant;
          }
        } catch (analyzeErr) {
          console.error("Analyzer stage failed — falling back to full-context edit:", analyzeErr);
        }
      }

      let parsed;
      try {
        parsed = await generateContent(
          modernEditSystemPrompt(files, applyMode, projectPlan, scopedPaths),
          prompt.trim(),
          GEMINI_API_KEY,
          ANTHROPIC_API_KEY,
        );
      } catch (err) {
        const status = err instanceof ProviderError ? err.status : 502;
        const message = status === 429
          ? "Rate limit exceeded. Please try again in a moment."
          : err instanceof Error ? err.message : "AI edit failed";
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const changedFiles: Record<string, string> = {};
      if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
        for (const [path, content] of Object.entries(parsed.files)) {
          const normalized = String(path).replace(/^\/+/, "");
          if (PROTECTED_PATHS.has(normalized)) continue;
          if (typeof content === "string") changedFiles[normalized] = content;
        }
      }

      const deletedFiles: string[] = Array.isArray(parsed.deleted_files)
        ? parsed.deleted_files
            .map((p: unknown) => String(p).replace(/^\/+/, ""))
            .filter((p: string) => !PROTECTED_PATHS.has(p))
        : [];

      // Merge server-side so the client gets a consistent full map back.
      let mergedFiles: Record<string, string> = { ...files, ...changedFiles };
      for (const path of deletedFiles) delete mergedFiles[path];

      // --- Smart Validation: deterministic checks + one QA fix round ---
      let validation = validateProject(mergedFiles);
      mergedFiles = validation.files; // dependency sync applied
      const qaReport = {
        issues_found: validation.issues.length,
        auto_fixes: validation.autoFixes,
        ai_fixed: 0,
        remaining: [] as { file: string; issue: string }[],
      };
      const qaFixedPaths: string[] = [];
      if (validation.issues.length > 0) {
        try {
          const fixes = await runQaFix(mergedFiles, validation.issues, GEMINI_API_KEY, ANTHROPIC_API_KEY);
          if (Object.keys(fixes).length > 0) {
            qaFixedPaths.push(...Object.keys(fixes).filter((p) => !changedFiles[p]));
            mergedFiles = { ...mergedFiles, ...fixes };
            const revalidation = validateProject(mergedFiles);
            mergedFiles = revalidation.files;
            qaReport.ai_fixed = validation.issues.length - revalidation.issues.length;
            qaReport.remaining = revalidation.issues;
            qaReport.auto_fixes = [...qaReport.auto_fixes, ...revalidation.autoFixes];
          } else {
            qaReport.remaining = validation.issues;
          }
        } catch (qaErr) {
          console.error("QA fix round failed (returning unfixed):", qaErr);
          qaReport.remaining = validation.issues;
        }
      }

      const result = {
        summary: parsed.summary || "Changes applied",
        changes: Array.isArray(parsed.changes) && parsed.changes.length > 0 ? parsed.changes : ["Code updated"],
        html: typeof parsed.preview_html === "string" && parsed.preview_html ? parsed.preview_html : (currentHtml || ""),
        css: typeof parsed.preview_css === "string" && parsed.preview_css ? parsed.preview_css : (currentCss || ""),
        react_code: mergedFiles["app/page.tsx"] || currentReactCode || "",
        files: mergedFiles,
        changed_paths: [
          ...Object.keys(changedFiles),
          ...deletedFiles.map((p) => `deleted: ${p}`),
          ...qaFixedPaths.map((p) => `qa-fixed: ${p}`),
        ],
        qa: qaReport,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================================
    // Legacy html/css editing (old static projects)
    // =====================================================================
    let parsed;
    try {
      parsed = await generateContent(
        legacyEditSystemPrompt(currentHtml, currentCss, currentReactCode, applyMode),
        prompt.trim(),
        GEMINI_API_KEY,
        ANTHROPIC_API_KEY,
      );
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : 502;
      const message = status === 429
        ? "Rate limit exceeded. Please try again in a moment."
        : err instanceof Error ? err.message : "AI edit failed";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      summary: parsed.summary || "Changes applied",
      html: parsed.html || currentHtml,
      css: parsed.css || currentCss,
      react_code: parsed.react_code || currentReactCode,
      changes: parsed.changes || ["Code updated"],
      files: null,
      changed_paths: [],
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-project error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
