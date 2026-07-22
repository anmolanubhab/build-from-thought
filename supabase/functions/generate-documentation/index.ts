// path: supabase/functions/generate-documentation/index.ts
//
// Documentation Engine — generation endpoint. Stateless by design (mirrors
// edit-project): given a project + a section key, it gathers REAL project
// context (files, planner context, database schema, deployments, domains,
// GitHub connection) and returns generated markdown. Persistence (saving the
// section + writing a version history row) happens client-side in
// src/services/documentation.ts, same division of responsibility edit-project
// already uses with project_versions.
//
// Auth: uses the caller's own JWT (forwarded Authorization header) so every
// read is subject to the same workspace-membership RLS as the rest of the
// app — this function never needs the service role key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateContent, ProviderError } from "../_shared/ai-providers.ts";
import {
  buildDocSectionPrompt, DOC_SECTION_KEYS,
  type DocSectionKey, type ProjectFacts, type SectionRequest,
} from "../_shared/doc-sections.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const projectId = typeof body.project_id === "string" ? body.project_id : null;
    const sectionKey = body.section_key as DocSectionKey;
    const mode = (body.mode === "regenerate" || body.mode === "merge") ? body.mode : "generate";
    const existingMarkdown = typeof body.existing_markdown === "string" ? body.existing_markdown : undefined;
    const audience = body.audience === "viva" ? "viva" : "client";
    const levels = Array.isArray(body.levels) ? body.levels.filter((l: unknown) => l === "basic" || l === "intermediate" || l === "advanced") : undefined;

    if (!projectId) return json({ error: "project_id is required" }, 400);
    if (!sectionKey || !DOC_SECTION_KEYS.includes(sectionKey)) {
      return json({ error: `section_key must be one of: ${DOC_SECTION_KEYS.join(", ")}` }, 400);
    }
    if (mode === "merge" && !existingMarkdown) {
      return json({ error: "existing_markdown is required for merge mode" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated" }, 401);

    // RLS (workspace membership) scopes every one of these reads automatically —
    // a mismatched project_id or a project outside the caller's workspaces just
    // comes back empty/null rather than needing a manual ownership check here.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, title, prompt, stack, type, is_multipage, files, plan")
      .eq("id", projectId)
      .single();
    if (projectError || !project) return json({ error: "Project not found or you don't have access to it" }, 404);

    const [{ data: dbRow }, { data: deployRows }, { data: domainRows }, { data: ghRow }] = await Promise.all([
      supabase.from("project_databases").select("provider, mode, table_prefix, tables, status").eq("project_id", projectId).maybeSingle(),
      supabase.from("deployments").select("provider, status, deploy_url").eq("project_id", projectId),
      supabase.from("project_domains").select("domain").eq("project_id", projectId),
      supabase.from("github_tokens").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

    const facts: ProjectFacts = {
      title: project.title,
      prompt: project.prompt,
      stack: project.stack,
      type: project.type,
      is_multipage: project.is_multipage,
      files: (project.files as Record<string, string> | null) ?? null,
      plan: (project.plan as Record<string, unknown> | null) ?? null,
      database: dbRow
        ? {
            provider: dbRow.provider,
            mode: dbRow.mode,
            table_prefix: dbRow.table_prefix,
            tables: Array.isArray(dbRow.tables) ? dbRow.tables as string[] : [],
          }
        : null,
      deployments: (deployRows ?? []).map((d: any) => ({ provider: d.provider, status: d.status, deploy_url: d.deploy_url })),
      domains: (domainRows ?? []).map((d: any) => d.domain),
      githubConnected: !!ghRow,
    };

    const sectionRequest: SectionRequest = {
      key: sectionKey,
      mode,
      existingMarkdown,
      audience,
      levels,
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY is not configured" }, 500);
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const { system, user: userPrompt } = buildDocSectionPrompt(facts, sectionRequest);

    let parsed: any;
    try {
      parsed = await generateContent(system, userPrompt, GEMINI_API_KEY, ANTHROPIC_API_KEY);
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : 502;
      const message = status === 429
        ? "Rate limit exceeded. Please try again in a moment."
        : err instanceof Error ? err.message : "Documentation generation failed";
      return json({ error: message }, status);
    }

    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : sectionKey;
    const contentMd = typeof parsed.content_md === "string" ? parsed.content_md : "";
    const contentJson = parsed.content_json && typeof parsed.content_json === "object" ? parsed.content_json : null;

    if (!contentMd.trim()) return json({ error: "The AI returned an empty document — please try again." }, 502);

    return json({
      title,
      content_md: contentMd,
      content_json: contentJson,
      // Lets the client compute/store an accurate "generated from this project state" fingerprint.
      fingerprint_inputs: {
        file_count: facts.files ? Object.keys(facts.files).length : 0,
        has_database: !!facts.database,
        deployment_count: facts.deployments.length,
      },
    });
  } catch (e) {
    console.error("generate-documentation error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
