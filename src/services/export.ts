import JSZip from "jszip";
import type { Project } from "@/lib/projects";
import { getProjectPages } from "@/lib/projects";

export async function downloadProject(project: Project): Promise<void> {
  const zip = new JSZip();
  const pages = getProjectPages(project);

  if (project.is_multipage && pages.length > 1) {
    // Multi-page: separate HTML files with shared CSS
    for (const page of pages) {
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title} - ${project.title}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  ${page.html || ""}
</body>
</html>`;
      zip.file(`${page.name}.html`, fullHtml);
    }

    if (project.css) {
      zip.file("style.css", project.css);
    }
  } else {
    // Single-page
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.title}</title>
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
    zip.file("index.html", fullHtml);
    if (project.css) zip.file("style.css", project.css);
  }

  if (project.react_code) {
    zip.file("App.jsx", project.react_code);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
