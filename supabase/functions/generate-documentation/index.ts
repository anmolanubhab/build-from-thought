// path: supabase/functions/generate-documentation/index.ts
//
// Documentation Engine — generation endpoint. Given a project + a section
// key, it gathers REAL project context (files, planner context, database
// schema, deployments, domains, GitHub connection) and returns generated
// markdown. Persistence of the SECTION (saving content + writing a version
// history row) happens client-side in src/services/documentation.ts, same
// division of responsibility edit-project already uses with project_versions.
//
// Project ANALYSIS (the derived facts scan — file tree, routes, API routes,
// env vars, auth files, components, package.json, README) is cached
// server-side in project_analysis_cache, keyed by the same project
// fingerprint the client already computes for Auto Sync
// (src/lib/documentation/hash.ts). A fingerprint match means "analyze once,
// reuse across every section generation" — this function skips the
// `projects` (incl. potentially large `files` jsonb) read entirely on a
// cache hit. A mismatch means the project changed, so the cache is
// recomputed and upserted; that's the whole invalidation story.
//
// Auth: uses the caller's own JWT (forwarded Authorization header) so every
// read is subject to the same workspace-membership RLS as the rest of the
// app — this function never needs the service role key. Reading
// project_analysis_cache first (before ever touching `projects`) is safe
// because it carries the same RLS policy (workspace membership via
// projects.workspace_id), so a cache hit is just as access-controlled as a
// full projects fetch would have been.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateContent, ProviderError } from "../_shared/ai-providers.ts";
import {
  buildDocSectionPrompt, deriveAnalysis, DOC_SECTION_KEYS,
  type DocSectionKey, type ProjectAnalysis, type ProjectFacts, type SectionRequest,
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
    // Client-computed fingerprint (src/lib/documentation/hash.ts) — same value
    // used for Auto Sync staleness detection, reused here as the
    // project_analysis_cache validity key. Optional for backward
    // compatibility with any caller that hasn't been updated yet; omitting it
    // just means every call recomputes (today's behavior), never an error.
    const projectFingerprint = typeof body.project_fingerprint === "string" ? body.project_fingerprint : null;

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

    // --- Analysis: cache hit or miss ---------------------------------------
    // project_analysis_cache carries the same workspace-membership RLS as
    // `projects` (joined through projects.workspace_id), so checking it first
    // is exactly as access-controlled as fetching `projects` directly would
    // be — a project outside the caller's workspaces just returns no row.
    let analysis: ProjectAnalysis | null = null;

    if (projectFingerprint) {
      const { data: cached } = await supabase
        .from("project_analysis_cache")
        .select("fingerprint, analysis")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cached && cached.fingerprint === projectFingerprint) {
        analysis = cached.analysis as unknown as ProjectAnalysis;
      }
    }

    let fileCountForResponse = analysis?.fileCount ?? 0;
    let databaseForResponse = analysis?.database ?? null;
    let deploymentsForResponse = analysis?.deployments ?? [];

    if (!analysis) {
      // Cache miss (first generation, stale fingerprint, or no fingerprint
      // sent) — fetch everything fresh, exactly as before.
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

      analysis = deriveAnalysis(facts);
      fileCountForResponse = analysis.fileCount;
      databaseForResponse = analysis.database;
      deploymentsForResponse = analysis.deployments;

      // Best-effort cache write — a failure here (e.g. transient network
      // blip) should never block generation, so it's fire-and-forget-ish:
      // await it for a clean edge-function shutdown, but don't fail the
      // request over it.
      if (projectFingerprint) {
        const { error: cacheError } = await supabase
          .from("project_analysis_cache")
          .upsert(
            { project_id: projectId, fingerprint: projectFingerprint, analysis: analysis as any, computed_at: new Date().toISOString() } as any,
            { onConflict: "project_id" },
          );
        if (cacheError) console.error("project_analysis_cache upsert failed (non-fatal):", cacheError.message);
      }
    }

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

    const { system, user: userPrompt } = buildDocSectionPrompt(analysis, sectionRequest);

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
        file_count: fileCountForResponse,
        has_database: !!databaseForResponse,
        deployment_count: deploymentsForResponse.length,
      },
    });
  } catch (e) {
    console.error("generate-documentation error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
