import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { getProjectPages } from "@/lib/projects";

export type DeployStatus = "idle" | "deploying" | "success" | "error";

/**
 * Deploy a project by storing it in storage as a static site.
 * Supports both single-page and multi-page projects.
 */
export async function deployProject(project: Project): Promise<string> {
  const pages = getProjectPages(project);

  if (project.is_multipage && pages.length > 1) {
    // Upload shared CSS
    if (project.css) {
      const cssBlob = new Blob([project.css], { type: "text/css" });
      await supabase.storage
        .from("deployed-sites")
        .upload(`${project.slug}/style.css`, cssBlob, { upsert: true, contentType: "text/css" });
    }

    // Upload each page
    for (const page of pages) {
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title} - ${project.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body>
  ${page.html || ""}
</body>
</html>`;

      const fileName = `${project.slug}/${page.name}.html`;
      const blob = new Blob([fullHtml], { type: "text/html" });
      const { error } = await supabase.storage
        .from("deployed-sites")
        .upload(fileName, blob, { upsert: true, contentType: "text/html" });

      if (error) throw new Error(`Deploy failed for ${page.name}: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("deployed-sites")
      .getPublicUrl(`${project.slug}/index.html`);

    return urlData.publicUrl;
  }

  // Single-page deploy (original)
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
    ${project.css || ""}
  </style>
</head>
<body>
  ${project.html || "<h1>Generated App</h1>"}
</body>
</html>`;

  const fileName = `${project.slug}/index.html`;
  const blob = new Blob([fullHtml], { type: "text/html" });

  const { error } = await supabase.storage
    .from("deployed-sites")
    .upload(fileName, blob, { upsert: true, contentType: "text/html" });

  if (error) throw new Error(`Deploy failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("deployed-sites")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
