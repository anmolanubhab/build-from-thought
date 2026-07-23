// path: supabase/functions/generate-app/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import { buildProjectFiles, DEPENDENCY_ALLOWLIST } from "./scaffold.ts";
import { validateProject, formatIssues, type ValidationIssue } from "./validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Template guidance — richer briefs per detected project category.
// The DB `type` column keeps the legacy 4-value union for frontend compat.
// ---------------------------------------------------------------------------

interface Template {
  legacyType: "portfolio" | "dashboard" | "landing" | "generic";
  brief: string;
}

const TEMPLATES: Record<string, Template> = {
  portfolio: {
    legacyType: "portfolio",
    brief:
      "A personal portfolio: hero with name/role and CTA, selected projects grid with cards, skills, about, contact section. Components: navbar, hero, projects, skills, about, contact, footer.",
  },
  dashboard: {
    legacyType: "dashboard",
    brief:
      "An admin dashboard: collapsible sidebar navigation, top header with search and user menu, KPI stat cards row, charts section (Recharts), recent-activity data table. Components: sidebar, header, stat-cards, charts, data-table.",
  },
  analytics: {
    legacyType: "dashboard",
    brief:
      "An analytics dashboard: KPI tiles with trend deltas, line/area charts over time (Recharts), a breakdown bar chart, top-items table, date-range selector in the header.",
  },
  crm: {
    legacyType: "dashboard",
    brief:
      "A CRM: sidebar, contacts/leads table with status badges and search, pipeline summary cards, lead detail side panel, activity timeline.",
  },
  erp: {
    legacyType: "dashboard",
    brief:
      "An ERP overview: sidebar with modules (inventory, orders, finance, HR), KPI cards, inventory table with stock-level badges, orders table, simple finance chart.",
  },
  invoice: {
    legacyType: "dashboard",
    brief:
      "An invoice system: invoices table with status badges (paid/pending/overdue), summary cards for totals, invoice detail view with line items, create-invoice form using react-hook-form + zod.",
  },
  booking: {
    legacyType: "dashboard",
    brief:
      "A booking system: service/slot cards, a booking form with date selection (date-fns) and validation (react-hook-form + zod), upcoming bookings list, confirmation state.",
  },
  chat: {
    legacyType: "generic",
    brief:
      "An AI chat interface: sidebar with conversation list, message thread with user/assistant bubbles, streaming-style typing indicator, composer with textarea and send button, empty state with suggested prompts.",
  },
  ecommerce: {
    legacyType: "landing",
    brief:
      "An e-commerce storefront: promo hero, product grid with cards (image placeholder, price, rating), category filter chips, cart drawer/summary component, footer with links.",
  },
  blog: {
    legacyType: "generic",
    brief:
      "A blog: featured-post hero, posts grid with cards (cover placeholder, tag, date via date-fns, excerpt), tag filter, newsletter signup section, footer.",
  },
  saas: {
    legacyType: "landing",
    brief:
      "A SaaS landing page: sticky navbar, hero with headline + CTA, logos strip, features grid, product screenshot section, pricing tiers, testimonials, FAQ accordion, footer.",
  },
  landing: {
    legacyType: "landing",
    brief:
      "A modern landing page: sticky navbar, hero with headline and CTA, features grid, testimonials, pricing, FAQ, footer. Smooth entrance animations with framer-motion.",
  },
  hospital: {
    legacyType: "landing",
    brief:
      "A hospital/clinic site: hero with appointment CTA, departments/services grid, doctors cards, appointment request form (react-hook-form + zod), contact/hours section, footer.",
  },
  school: {
    legacyType: "landing",
    brief:
      "A school website: hero, programs/courses grid, faculty highlights, admissions steps section, testimonials, enquiry form with validation, footer.",
  },
  restaurant: {
    legacyType: "landing",
    brief:
      "A restaurant site: hero with reservation CTA, menu sections with dish cards and prices, gallery grid, opening hours + location, reservation form with validation, footer.",
  },
  finance: {
    legacyType: "dashboard",
    brief:
      "A finance dashboard: balance/spend KPI cards, portfolio or cash-flow chart (Recharts), transactions table with category badges, budgets progress section.",
  },
};

function detectTemplate(prompt: string): { key: string; template: Template } {
  const lower = prompt.toLowerCase();
  const checks: [string, string[]][] = [
    ["portfolio", ["portfolio"]],
    ["crm", ["crm", "lead", "sales pipeline"]],
    ["erp", ["erp"]],
    ["invoice", ["invoice", "billing"]],
    ["booking", ["booking", "appointment", "reservation system"]],
    ["chat", ["chat", "chatbot", "ai assistant"]],
    ["ecommerce", ["e-commerce", "ecommerce", "shop", "store", "product catalog"]],
    ["blog", ["blog", "articles", "magazine"]],
    ["hospital", ["hospital", "clinic", "medical", "doctor"]],
    ["school", ["school", "college", "university", "academy"]],
    ["restaurant", ["restaurant", "cafe", "food menu"]],
    ["finance", ["finance", "banking", "budget", "expense"]],
    ["analytics", ["analytics"]],
    ["dashboard", ["dashboard", "admin"]],
    ["saas", ["saas"]],
    ["landing", ["landing", "startup", "homepage"]],
  ];
  for (const [key, words] of checks) {
    if (words.some((w) => lower.includes(w))) return { key, template: TEMPLATES[key] };
  }
  return {
    key: "landing",
    template: { legacyType: "generic", brief: TEMPLATES.landing.brief },
  };
}

// ---------------------------------------------------------------------------
// Providers: Gemini primary, Claude fallback.
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
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
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
): Promise<{ parsed: any; provider: "gemini" | "claude" }> {
  try {
    const content = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    return { parsed: parseJSON(content), provider: "gemini" };
  } catch (geminiErr) {
    const geminiMessage = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    if (!anthropicKey) throw geminiErr;
    console.error(`Gemini failed (${geminiMessage}) — falling back to Claude`);
    try {
      const content = await generateWithClaude(anthropicKey, systemPrompt, userPrompt);
      return { parsed: parseJSON(content), provider: "claude" };
    } catch (claudeErr) {
      const claudeMessage = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
      console.error("Claude fallback also failed:", claudeMessage);
      const status = geminiErr instanceof ProviderError && geminiErr.status === 429 ? 429 : 502;
      throw new ProviderError(
        `Gemini failed (${geminiMessage}) and Claude fallback also failed (${claudeMessage})`,
        status,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Plan-driven brief (Phase 2): turns the Planner Agent's structured plan into
// a precise builder brief, replacing generic template guidance.
// ---------------------------------------------------------------------------

function planToBrief(plan: any): string {
  const routes = (plan.routes || [])
    .map((r: any) => `  - ${r.path}: ${r.purpose || ""}`)
    .join("\n");
  const components = (plan.components || [])
    .map((c: any) => `  - ${c.file}${c.client ? ' ("use client")' : ""}: ${c.purpose || ""}`)
    .join("\n");
  const design = plan.design || {};
  const tables = (plan.database_tables || [])
    .map((t: any) => `  - ${t.name}: ${t.purpose || ""} [${(t.columns || []).join(", ")}]`)
    .join("\n");

  let brief = `EXECUTION PLAN (produced by the Planner Agent — follow it precisely):
Understanding: ${plan.understanding || ""}
Project type: ${plan.project_type || "landing"} · Complexity: ${plan.complexity || "medium"}

Routes to build:
${routes || "  - /: Main page"}

Components to build (each in its own file):
${components || "  (choose sensible section components)"}

Design direction: ${design.mode || "light"} mode · ${design.style || "clean modern"} · ${design.accent || ""}
${design.notes ? `Design notes: ${design.notes}` : ""}

Planned dependencies: ${(plan.dependencies || []).join(", ") || "none beyond the scaffold"}`;

  if (plan.needs_database) {
    brief += `

DATA LAYER (the plan requires persisted data):
Planned tables:
${tables || "  (design a minimal schema)"}
- Generate "supabase/schema.sql" with CREATE TABLE statements + sensible RLS policies for the planned tables.
- Generate "lib/data.ts" exporting typed functions and realistic SAMPLE DATA so the app fully works standalone without any backend configured.
- Generate "types/index.ts" with the shared TypeScript types for these entities.
- Components consume lib/data.ts — never call a database directly. Add a short "Connect a database" section to the code comments in lib/data.ts explaining that schema.sql can be applied to a Supabase project later.`;
  }
  if (plan.needs_auth) {
    brief += `
- The plan flags authentication: include a polished sign-in UI page/component, but wire it to lib/data.ts mock auth (no real backend). Note this clearly in code comments.`;
  }
  return brief;
}

// ---------------------------------------------------------------------------
// Modern (Next.js 15) system prompt
// ---------------------------------------------------------------------------

function modernSystemPrompt(templateBrief: string, multiRoute: boolean): string {
  const allowedDeps = Object.keys(DEPENDENCY_ALLOWLIST).join(", ");
  return `You are a senior full-stack engineer generating a production-ready Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 application.

A scaffold ALREADY EXISTS — do NOT generate these files (they are provided): package.json, tsconfig.json, next.config.ts, postcss.config.mjs, app/globals.css, lib/utils.ts (exports cn()), components/ui/button.tsx (Button with variants default/outline/secondary/ghost/destructive/link and sizes sm/default/lg/icon), components/ui/card.tsx (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter), components/ui/input.tsx (Input), components/ui/badge.tsx (Badge). Import them via the "@/" alias, e.g. import { Button } from "@/components/ui/button".

app/globals.css defines shadcn-style design tokens usable as Tailwind classes: bg-background, text-foreground, bg-card, text-card-foreground, bg-primary, text-primary-foreground, bg-secondary, bg-muted, text-muted-foreground, bg-accent, text-destructive, border-border, ring-ring, rounded-lg (radius tokens). Dark mode works via the "dark" class. ALWAYS use these tokens — never hardcode hex colors except for decorative gradients.

Project brief for this category: ${templateBrief}

You MUST respond with valid JSON only, with this exact structure:
{
  "title": "Short product-style title",
  "description": "One-sentence description used for metadata",
  "dependencies": ["framer-motion"],
  "files": {
    "app/page.tsx": "...",
    "components/navbar.tsx": "...",
    "components/hero.tsx": "..."
  },
  "preview_html": "Self-contained static HTML approximation of the home page (body innerHTML only, no scripts)",
  "preview_css": "Plain CSS for preview_html (NO Tailwind — the preview iframe has no build step)"
}

ARCHITECTURE RULES (strict):
- TypeScript only. Every component in its own file. NEVER one huge page file.
- app/page.tsx composes section components imported from components/ (e.g. <Navbar />, <Hero />, <Features />). Keep page files under ~60 lines.
- Server Components by default; add "use client" ONLY to files that use hooks, event handlers, framer-motion, or browser APIs.
- Folder conventions: app/ (routes), components/ (sections & shared), components/ui/ (primitives), lib/ (utilities), types/ (shared types when needed). No other top-level folders.
${multiRoute ? '- Create additional routes as app/<route>/page.tsx (e.g. app/about/page.tsx) with a shared navbar component linking them via next/link.' : "- Single route only: app/page.tsx."}
- "dependencies": list ONLY packages you actually import, chosen from: ${allowedDeps}. Icons come from lucide-react (already installed). Do not list anything else.
- Use next/link for navigation. Do NOT use react-router, Bootstrap, jQuery, Material UI, class components, or inline style objects (except dynamic values like chart dimensions).

QUALITY RULES:
- Responsive at mobile/tablet/desktop (Tailwind sm/md/lg breakpoints). Mobile navbar collapses to a menu button.
- Accessible: semantic HTML (header/nav/main/section/footer), aria-labels on icon-only buttons, alt text, visible focus states, label htmlFor on inputs.
- Realistic, specific placeholder content — real-sounding names, numbers, copy. Never lorem ipsum.
- Include hover states, empty states where lists could be empty, and loading/disabled states on submit buttons.
- Forms use react-hook-form + zod with @hookform/resolvers when the app has a form.
- Charts use recharts inside a "use client" component.
- Polished modern aesthetic: generous whitespace, consistent spacing scale, subtle borders, restrained color; quality bar of Linear/Stripe/Vercel marketing pages. Do not copy any real product's content.

PREVIEW RULES:
- preview_html/preview_css visually approximate the FINAL rendered home page (same layout, colors, text) as static HTML with plain CSS.
- Dark or light per what suits the app; make it look identical in spirit to the React version.
- No <script>, no <html>/<head>/<body> wrappers, no external assets. Use CSS gradients/solid colors instead of images.

Escape all JSON string content correctly. Keep total output focused: 4-10 component files of clean code beat 20 bloated ones.`;
}

// ---------------------------------------------------------------------------
// QA Agent (Phase 2): fixes issues the deterministic validator found.
// ---------------------------------------------------------------------------

async function runQaFix(
  files: Record<string, string>,
  issues: ValidationIssue[],
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<Record<string, string>> {
  const affected = new Set(issues.map((i) => i.file));
  // Include files mentioned in issues plus the entry points for context.
  affected.add("app/page.tsx");
  const affectedDump = [...affected]
    .filter((p) => files[p] !== undefined)
    .map((p) => `--- FILE: ${p} ---\n${files[p]}`)
    .join("\n\n");
  const fileList = Object.keys(files).sort().join("\n");

  const systemPrompt = `You are the QA Agent of WebdevsAI. A deterministic validator found concrete problems in a freshly generated Next.js 15 + TypeScript + Tailwind v4 project. Fix ONLY these problems — change nothing else.

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
- Return ONLY files you fixed or created (e.g. a missing component a page imports).
- Full file contents, not diffs. Preserve everything unrelated to the listed problems.
- Missing "use client": add the directive as the very first line.
- Unresolved import of a missing file: CREATE that file with a sensible, complete implementation matching how it is used.
- Broken route link: either create app/<route>/page.tsx or point the link at an existing route — whichever the surrounding code implies.
- Unavailable package: rewrite the importing code using available packages or plain React/Tailwind.
- Never touch package.json, tsconfig.json, next.config.ts, postcss.config.mjs, or .gitignore.`;

  const parsed = (await generateContent(systemPrompt, "Fix the listed problems now.", geminiKey, anthropicKey)).parsed;
  const fixes: Record<string, string> = {};
  if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    for (const [path, content] of Object.entries(parsed.files)) {
      const normalized = String(path).replace(/^\/+/, "");
      if (["package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", ".gitignore"].includes(normalized)) continue;
      if (typeof content === "string" && content.length > 0) fixes[normalized] = content;
    }
  }
  return fixes;
}

// ---------------------------------------------------------------------------
// Legacy static system prompts (kept for stack: "static" requests)
// ---------------------------------------------------------------------------

const LEGACY_ENHANCERS: Record<string, string> = {
  portfolio:
    "Create a modern, responsive portfolio website with a hero section featuring the developer's name and title, a projects grid with card components, a skills section, and a contact form. Use a dark theme with accent colors.",
  dashboard:
    "Create a professional admin dashboard with a sidebar navigation, stat cards showing KPIs (users, revenue, growth), a data table, and a chart section. Use a dark theme with clean typography.",
  landing:
    "Create a modern SaaS landing page with a hero section with headline and CTA button, a features grid, pricing cards, testimonials, and a footer. Use a dark gradient theme.",
  generic:
    "Create a clean, modern single-page web application with a header, main content area, and footer. Use a dark theme with good spacing and typography.",
};

function legacySystemPrompt(type: string): string {
  return `You are an expert web developer. Generate a complete single-page website based on the user's description.

You MUST respond with valid JSON only. The JSON must have this exact structure:
{
  "title": "Short descriptive title for the project",
  "type": "${type}",
  "html": "Complete HTML content (body inner HTML only, no <html>, <head>, or <body> tags)",
  "css": "Complete CSS styles for the page",
  "react_code": "Complete React component code as a single functional component with inline styles or Tailwind classes"
}

Requirements:
- The HTML should be self-contained and render a complete, visually appealing page
- Use modern CSS with flexbox/grid, dark backgrounds (#0f172a, #1e293b), white/gray text, and accent colors
- The React code should be a single default export component using React with Tailwind CSS classes
- Make the design professional, polished, and responsive
- Include realistic placeholder content (names, numbers, text)
- Do NOT include any script tags in the HTML
- Do NOT include any import statements in the HTML`;
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, is_multipage, stack, plan } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // --- Credits: fetch, reset if a day has passed, and check balance ---
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_remaining, credits_daily_limit, credits_reset_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Could not load profile credits");

    let creditsRemaining = profile.credits_remaining;
    const dailyLimit = profile.credits_daily_limit ?? 5;
    const resetAt = new Date(profile.credits_reset_at).getTime();
    const shouldReset = Date.now() - resetAt >= ONE_DAY_MS;
    if (shouldReset) creditsRemaining = dailyLimit;

    if (creditsRemaining <= 0) {
      return new Response(
        JSON.stringify({ error: "You're out of daily credits. They reset every 24 hours." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newCredits = creditsRemaining - 1;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        credits_remaining: newCredits,
        ...(shouldReset ? { credits_reset_at: new Date().toISOString() } : {}),
      })
      .eq("id", user.id);
    if (updateError) console.error("Failed to update credits:", updateError.message);

    const { error: usageError } = await supabase
      .from("credit_usage_events")
      .insert({ user_id: user.id, amount: 1 });
    if (usageError) console.error("Failed to log credit usage:", usageError.message);

    const { key: templateKey, template } = detectTemplate(prompt);

    // =====================================================================
    // Legacy static generation (opt-in via stack: "static")
    // =====================================================================
    if (stack === "static") {
      const enhanced = `${LEGACY_ENHANCERS[template.legacyType]} The user's specific request: "${prompt.trim()}"`;
      let generated;
      try {
        generated = await generateContent(legacySystemPrompt(template.legacyType), enhanced, GEMINI_API_KEY, ANTHROPIC_API_KEY);
      } catch (err) {
        const status = err instanceof ProviderError ? err.status : 502;
        const message = status === 429
          ? "Rate limit exceeded. Please try again in a moment."
          : err instanceof Error ? err.message : "AI generation failed";
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = generated.parsed;
      return new Response(
        JSON.stringify({
          title: parsed.title || prompt.slice(0, 60),
          type: parsed.type || template.legacyType,
          html: parsed.html || "<div><h1>Generated App</h1></div>",
          css: parsed.css || "",
          react_code: parsed.react_code || "",
          is_multipage: false,
          stack: "static",
          files: null,
          credits_remaining: newCredits,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =====================================================================
    // Modern generation (default): full Next.js 15 project
    // Phase 2: when the Planner Agent's plan is provided, it drives the brief.
    // =====================================================================
    const multiRoute = is_multipage !== false;
    const hasPlan = plan && typeof plan === "object" && Array.isArray(plan.routes);
    const brief = hasPlan ? planToBrief(plan) : template.brief;
    const systemPrompt = modernSystemPrompt(brief, multiRoute);
    const userPrompt = hasPlan
      ? `Build this application: "${prompt.trim()}"

Follow the execution plan in the brief precisely — build exactly the planned routes and components.`
      : `Build this application: "${prompt.trim()}"

Template category detected: ${templateKey}. Follow the brief but adapt everything to the user's actual request.`;

    let generated;
    try {
      generated = await generateContent(systemPrompt, userPrompt, GEMINI_API_KEY, ANTHROPIC_API_KEY);
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : 502;
      const message = status === 429
        ? "Rate limit exceeded. Please try again in a moment."
        : err instanceof Error ? err.message : "AI generation failed";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (generated.provider === "claude") console.log("Generated with Claude fallback");

    const parsed = generated.parsed;
    const title = typeof parsed.title === "string" && parsed.title ? parsed.title : prompt.slice(0, 60);
    const description = typeof parsed.description === "string" ? parsed.description : `${title} — built with WebdevsAI`;
    const aiFiles: Record<string, string> =
      parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files) ? parsed.files : {};
    const requestedDeps: string[] = Array.isArray(parsed.dependencies)
      ? parsed.dependencies.filter((d: unknown) => typeof d === "string")
      : [];

    if (!aiFiles["app/page.tsx"]) {
      return new Response(JSON.stringify({ error: "Generation incomplete (missing app/page.tsx) — please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plannedDeps: string[] = hasPlan && Array.isArray(plan.dependencies)
      ? plan.dependencies.filter((d: unknown) => typeof d === "string")
      : [];
    let files = buildProjectFiles(title, description, prompt.trim(), aiFiles, [
      ...new Set([...requestedDeps, ...plannedDeps]),
    ]);

    // --- Smart Validation (Phase 2): deterministic checks + one QA fix round ---
    let validation = validateProject(files);
    files = validation.files; // dependency sync applied
    const qaReport = {
      issues_found: validation.issues.length,
      auto_fixes: validation.autoFixes,
      ai_fixed: 0,
      remaining: [] as { file: string; issue: string }[],
    };

    if (validation.issues.length > 0) {
      try {
        const fixes = await runQaFix(files, validation.issues, GEMINI_API_KEY, ANTHROPIC_API_KEY);
        if (Object.keys(fixes).length > 0) {
          files = { ...files, ...fixes };
          const revalidation = validateProject(files);
          files = revalidation.files;
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
      title,
      type: hasPlan && ["portfolio", "dashboard", "landing", "generic"].includes(plan.legacy_type)
        ? plan.legacy_type
        : template.legacyType,
      html: typeof parsed.preview_html === "string" ? parsed.preview_html : "<div><h1>Preview unavailable</h1></div>",
      css: typeof parsed.preview_css === "string" ? parsed.preview_css : "",
      react_code: files["app/page.tsx"] || "",
      is_multipage: false,
      pages: null,
      stack: "nextjs",
      files,
      plan: hasPlan ? plan : null,
      qa: qaReport,
      credits_remaining: newCredits,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-app error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
