// path: supabase/functions/generate-app/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const PROMPT_ENHANCERS: Record<string, string> = {
  portfolio:
    "Create a modern, responsive portfolio website with a hero section featuring the developer's name and title, a projects grid with card components, a skills section, and a contact form. Use a dark theme with accent colors.",
  dashboard:
    "Create a professional admin dashboard with a sidebar navigation, stat cards showing KPIs (users, revenue, growth), a data table, and a chart section. Use a dark theme with clean typography.",
  landing:
    "Create a modern SaaS landing page with a hero section with headline and CTA button, a features grid, pricing cards, testimonials, and a footer. Use a dark gradient theme.",
  generic:
    "Create a clean, modern single-page web application with a header, main content area, and footer. Use a dark theme with good spacing and typography.",
};

function detectType(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("portfolio")) return "portfolio";
  if (lower.includes("dashboard") || lower.includes("admin") || lower.includes("analytics")) return "dashboard";
  if (lower.includes("landing") || lower.includes("startup") || lower.includes("saas")) return "landing";
  return "generic";
}

function detectMultipageHint(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const pages: string[] = ["index"];
  if (lower.includes("about")) pages.push("about");
  if (lower.includes("contact")) pages.push("contact");
  if (lower.includes("service")) pages.push("services");
  if (lower.includes("blog")) pages.push("blog");
  if (lower.includes("team")) pages.push("team");
  if (lower.includes("pricing")) pages.push("pricing");
  if (lower.includes("faq")) pages.push("faq");
  if (pages.length === 1) {
    pages.push("about", "contact");
  }
  return pages;
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });
  return response;
}

function parseJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    const braceStart = content.indexOf("{");
    const braceEnd = content.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1) {
      return JSON.parse(content.substring(braceStart, braceEnd + 1));
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require a logged-in user (also stops anonymous credit/cost abuse) ---
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
      { global: { headers: { Authorization: authHeader } } }
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
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // --- Credits: fetch, reset if a day has passed, and check balance ---
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_remaining, credits_daily_limit, credits_reset_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Could not load profile credits");
    }

    let creditsRemaining = profile.credits_remaining;
    const dailyLimit = profile.credits_daily_limit ?? 5;
    const resetAt = new Date(profile.credits_reset_at).getTime();
    const shouldReset = Date.now() - resetAt >= ONE_DAY_MS;

    if (shouldReset) {
      creditsRemaining = dailyLimit;
    }

    if (creditsRemaining <= 0) {
      return new Response(
        JSON.stringify({ error: "You're out of daily credits. They reset every 24 hours." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    if (updateError) {
      console.error("Failed to update credits:", updateError.message);
    }

    const type = detectType(prompt);
    const isMultipage = is_multipage !== false;

    if (!isMultipage) {
      const enhancedPrompt = `${PROMPT_ENHANCERS[type]} The user's specific request: "${prompt.trim()}"`;
      const systemPrompt = `You are an expert web developer. Generate a complete single-page website based on the user's description.

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

      const response = await callGemini(GEMINI_API_KEY, systemPrompt, enhancedPrompt);

      if (!response.ok) {
        const text = await response.text();
        console.error("Gemini API error:", response.status, text);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No content in AI response");

      const parsed = parseJSON(content);
      const result = {
        title: parsed.title || prompt.slice(0, 60),
        type: parsed.type || type,
        html: parsed.html || "<div><h1>Generated App</h1></div>",
        css: parsed.css || "",
        react_code: parsed.react_code || "",
        is_multipage: false,
        credits_remaining: newCredits,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageNames = detectMultipageHint(prompt);
    const pagesDesc = pageNames.map((p) => {
      if (p === "index") return "index (Home page)";
      return `${p} (${p.charAt(0).toUpperCase() + p.slice(1)} page)`;
    }).join(", ");

    const enhancedPrompt = `${PROMPT_ENHANCERS[type]} The user's specific request: "${prompt.trim()}"
    
Generate a multi-page website with these pages: ${pagesDesc}.`;

    const systemPrompt = `You are an expert web developer. Generate a complete multi-page static website based on the user's description.

You MUST respond with valid JSON only. The JSON must have this exact structure:
{
  "title": "Short descriptive title for the project",
  "type": "${type}",
  "css": "Complete shared CSS styles used across ALL pages",
  "pages": [
    { "name": "index", "title": "Home", "html": "Complete HTML body content for the home page" },
    { "name": "about", "title": "About", "html": "Complete HTML body content for the about page" }
  ]
}

CRITICAL Requirements:
- Generate ${pageNames.length} pages: ${pagesDesc}
- Each page MUST include a shared navigation bar at the top with links to ALL pages
- Navigation links must use relative hrefs: "index.html", "about.html", "contact.html" etc.
- The active page link should be visually highlighted in the nav
- CSS is SHARED across all pages - write it once in the "css" field
- Use modern CSS with flexbox/grid, dark backgrounds (#0f172a, #1e293b), white/gray text, and accent colors
- Each page should have unique, relevant content - NOT placeholder text
- Make the design professional, polished, and responsive
- Include a consistent footer across all pages
- Do NOT include any <script> tags in the HTML
- Do NOT include <html>, <head>, or <body> tags - just the body innerHTML
- The "name" field should be the filename without .html extension (e.g., "index", "about", "contact")`;

    const response = await callGemini(GEMINI_API_KEY, systemPrompt, enhancedPrompt);

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini API error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("No content in AI response");

    const parsed = parseJSON(content);

    const pages = Array.isArray(parsed.pages) && parsed.pages.length > 0
      ? parsed.pages.map((p: any) => ({
          name: p.name || "index",
          title: p.title || p.name || "Page",
          html: p.html || "",
        }))
      : [{ name: "index", title: "Home", html: parsed.html || "<div><h1>Generated App</h1></div>" }];

    const result = {
      title: parsed.title || prompt.slice(0, 60),
      type: parsed.type || type,
      html: pages[0]?.html || "",
      css: parsed.css || "",
      react_code: "",
      is_multipage: true,
      pages,
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
