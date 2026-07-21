// path: supabase/functions/plan-project/index.ts
// Planner Agent — Phase 2 AI Planning Engine.
// Produces a structured execution plan BEFORE any code is generated.
// Free of charge (generation itself spends the credit); auth required.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";

const CATEGORIES = [
  "landing", "saas", "portfolio", "dashboard", "analytics", "crm", "erp",
  "invoice", "booking", "chat", "ecommerce", "blog", "hospital", "school",
  "restaurant", "finance",
];

const LEGACY_TYPE_MAP: Record<string, string> = {
  portfolio: "portfolio",
  dashboard: "dashboard", analytics: "dashboard", crm: "dashboard", erp: "dashboard",
  invoice: "dashboard", booking: "dashboard", finance: "dashboard",
  landing: "landing", saas: "landing", ecommerce: "landing",
  hospital: "landing", school: "landing", restaurant: "landing",
  chat: "generic", blog: "generic",
};

const ALLOWED_DEPS =
  "framer-motion, recharts, react-hook-form, zod, @hookform/resolvers, date-fns, sonner, cmdk, " +
  "@radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs, @radix-ui/react-select, " +
  "@radix-ui/react-switch, @radix-ui/react-avatar, @radix-ui/react-tooltip, @radix-ui/react-accordion, " +
  "@radix-ui/react-checkbox, @radix-ui/react-label, @radix-ui/react-popover, @radix-ui/react-progress, " +
  "@radix-ui/react-slider, @supabase/supabase-js";

function plannerSystemPrompt(multiRoute: boolean): string {
  return `You are the Planner Agent of WebdevsAI — a senior software architect. Before ANY code is generated, you analyze the user's request and produce a precise execution plan for a Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 application.

Think like an experienced architect: understand the goal, decide the minimal set of routes and reusable components, decide whether the app needs a database/auth/api layer, pick only the packages that are truly required, and sequence the work.

You MUST respond with valid JSON only, with this exact structure:
{
  "understanding": "1-2 sentence restatement of what the user actually wants",
  "project_type": "one of: ${CATEGORIES.join(", ")}",
  "title": "Short product-style title",
  "description": "One-sentence description for metadata",
  "routes": [
    { "path": "/", "purpose": "what this page shows" }
  ],
  "components": [
    { "file": "components/navbar.tsx", "purpose": "sticky top navigation", "client": false }
  ],
  "needs_database": false,
  "needs_auth": false,
  "needs_api": false,
  "database_tables": [
    { "name": "bookings", "purpose": "stores appointment requests", "columns": ["id uuid pk", "name text", "created_at timestamptz"] }
  ],
  "dependencies": ["framer-motion"],
  "design": {
    "mode": "light or dark",
    "style": "3-6 word aesthetic direction",
    "accent": "color direction, e.g. 'violet primary, warm neutrals'",
    "notes": "1-2 sentences of layout/visual guidance"
  },
  "milestones": ["Design layout system", "Build shared components", "Build pages", "Wire data layer", "Validate"],
  "complexity": "low, medium, or high"
}

PLANNING RULES:
- ${multiRoute ? "Plan 1-4 routes; only add routes the request genuinely needs. Every route beyond '/' must earn its place." : "Plan exactly one route: '/'."}
- Components: 4-10 focused, reusable pieces, each its own file under components/. Set "client": true ONLY for components needing hooks, event handlers, framer-motion, or recharts.
- "dependencies": choose ONLY from: ${ALLOWED_DEPS}. List only what the planned components actually require. Icons (lucide-react) are always available — never list them.
- needs_database is true only when the app's core value requires persisted user data (bookings, invoices, CRM records). Marketing/landing/portfolio sites: false.
- database_tables: empty array unless needs_database is true; keep schemas minimal and correct.
- needs_auth true only when the plan involves per-user private data.
- Keep the plan minimal and buildable: prefer 1 route with excellent components over 4 shallow routes.
- Do not include any prose outside the JSON.`;
}

class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No content in Claude response");
  return textBlock.text;
}

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

    const { prompt, is_multipage } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const systemPrompt = plannerSystemPrompt(is_multipage !== false);
    const userPrompt = `Plan this application: "${prompt.trim()}"`;

    let parsed: any;
    try {
      parsed = parseJSON(await generateWithGemini(GEMINI_API_KEY, systemPrompt, userPrompt));
    } catch (geminiErr) {
      if (!ANTHROPIC_API_KEY) throw geminiErr;
      console.error("Planner: Gemini failed, falling back to Claude");
      parsed = parseJSON(await generateWithClaude(ANTHROPIC_API_KEY, systemPrompt, userPrompt));
    }

    // Normalize + harden the plan shape so downstream consumers can trust it.
    const projectType = CATEGORIES.includes(parsed.project_type) ? parsed.project_type : "landing";
    const plan = {
      understanding: typeof parsed.understanding === "string" ? parsed.understanding : prompt.slice(0, 200),
      project_type: projectType,
      legacy_type: LEGACY_TYPE_MAP[projectType] || "generic",
      title: typeof parsed.title === "string" && parsed.title ? parsed.title : prompt.slice(0, 60),
      description: typeof parsed.description === "string" ? parsed.description : "",
      routes: Array.isArray(parsed.routes) && parsed.routes.length > 0
        ? parsed.routes.filter((r: any) => r && typeof r.path === "string").slice(0, 6)
        : [{ path: "/", purpose: "Main page" }],
      components: Array.isArray(parsed.components)
        ? parsed.components.filter((c: any) => c && typeof c.file === "string").slice(0, 14)
        : [],
      needs_database: parsed.needs_database === true,
      needs_auth: parsed.needs_auth === true,
      needs_api: parsed.needs_api === true,
      database_tables: Array.isArray(parsed.database_tables) ? parsed.database_tables.slice(0, 8) : [],
      dependencies: Array.isArray(parsed.dependencies)
        ? parsed.dependencies.filter((d: unknown) => typeof d === "string")
        : [],
      design: parsed.design && typeof parsed.design === "object" ? parsed.design : { mode: "light", style: "clean modern", accent: "", notes: "" },
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones.slice(0, 8) : [],
      complexity: ["low", "medium", "high"].includes(parsed.complexity) ? parsed.complexity : "medium",
    };

    return new Response(JSON.stringify({ plan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-project error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
