// path: supabase/functions/vercel-deploy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPageHtml(title: string, css: string, bodyHtml: string, cssHref?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
${cssHref ? `<link rel="stylesheet" href="${cssHref}" />` : ""}
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family: 'Inter', system-ui, sans-serif; } ${cssHref ? "" : css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { project_id, env_vars, target, version_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const deployTarget = target === "preview" ? "preview" : "production";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Content source: either the live project, or (for previewing a draft)
    // a specific project_versions row.
    let contentTitle = project.title;
    let contentCss = project.css || "";
    let contentHtml = project.html || "<h1>Generated App</h1>";
    let contentPages: any[] | null = project.is_multipage ? project.pages : null;
    let contentFiles: Record<string, string> | null =
      project.files && typeof project.files === "object" && !Array.isArray(project.files) && Object.keys(project.files).length > 0
        ? project.files
        : null;

    if (version_id) {
      const { data: version, error: versionError } = await admin
        .from("project_versions")
        .select("html, css, react_code, pages, files, project_id")
        .eq("id", version_id)
        .eq("project_id", project_id)
        .single();
      if (versionError || !version) {
        return new Response(JSON.stringify({ error: "Version not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      contentCss = version.css || "";
      contentHtml = version.html || "<h1>Generated App</h1>";
      contentPages = Array.isArray(version.pages) ? version.pages : null;
      contentFiles =
        version.files && typeof version.files === "object" && !Array.isArray(version.files) && Object.keys(version.files).length > 0
          ? version.files
          : null;
    }

    const { data: connection, error: connError } = await admin
      .from("vercel_connections")
      .select("access_token, team_id")
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connect your Vercel account first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const files: { file: string; data: string }[] = [];
    const envVarKeys = env_vars ? Object.keys(env_vars) : [];
    const isModern = !!contentFiles;

    if (isModern) {
      // Modern project: deploy the full Next.js source — Vercel builds it.
      for (const [path, data] of Object.entries(contentFiles!)) {
        if (typeof data === "string") files.push({ file: path, data });
      }
    } else if (contentPages && contentPages.length > 0) {
      if (contentCss) files.push({ file: "style.css", data: contentCss });
      for (const page of contentPages) {
        const html = buildPageHtml(`${page.title || page.name} - ${contentTitle}`, contentCss, page.html || "", contentCss ? "style.css" : undefined);
        files.push({ file: `${page.name}.html`, data: html });
      }
      files.push({ file: "vercel.json", data: JSON.stringify({ cleanUrls: false }) });
    } else {
      const html = buildPageHtml(contentTitle, contentCss, contentHtml);
      files.push({ file: "index.html", data: html });
      files.push({ file: "vercel.json", data: JSON.stringify({ cleanUrls: false }) });
    }

    // Preview deployments get their own project name suffix so they never
    // collide with (or move) the production alias.
    const deployName = deployTarget === "preview" ? `${project.slug}-preview` : project.slug;

    const deployBody: Record<string, unknown> = {
      name: deployName,
      files,
      target: deployTarget,
      projectSettings: isModern
        ? { framework: "nextjs", installCommand: "npm install --legacy-peer-deps" }
        : { framework: null },
    };

    if (env_vars && envVarKeys.length > 0) {
      deployBody.env = env_vars;
      if (isModern) deployBody.build = { env: env_vars };
    }

    const teamQuery = connection.team_id ? `?teamId=${connection.team_id}` : "";
    const deployRes = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deployBody),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      const message = deployData?.error?.message || `Vercel deploy failed (${deployRes.status})`;
      if (deployTarget === "production") {
        await admin.from("deployments").insert({
          project_id, provider: "vercel", status: "failed", error_message: message, env_var_keys: envVarKeys,
        });
      }
      return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const deployUrl = `https://${deployData.url}`;
    const productionAlias: string | null = Array.isArray(deployData.alias) && deployData.alias.length > 0 ? deployData.alias[0] : null;

    if (deployTarget === "preview") {
      // Preview deploys don't affect production history/rollback - just
      // record the URL against the draft version if one was given.
      if (version_id) {
        await admin.from("project_versions").update({ preview_url: deployUrl }).eq("id", version_id);
      }
      return new Response(JSON.stringify({ url: deployUrl, status: "building", external_id: deployData.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: deploymentRow, error: insertError } = await admin
      .from("deployments")
      .insert({
        project_id, provider: "vercel", status: "building", external_id: deployData.id,
        deploy_url: deployUrl, env_var_keys: envVarKeys, production_alias: productionAlias,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to record deployment:", insertError.message);
    }

    return new Response(JSON.stringify({
      deployment_id: deploymentRow?.id,
      external_id: deployData.id,
      url: deployUrl,
      status: "building",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vercel-deploy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
