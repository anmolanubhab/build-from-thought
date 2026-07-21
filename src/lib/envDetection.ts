// path: src/lib/envDetection.ts
import type { Project } from "@/lib/projects";
import { getProjectPages } from "@/lib/projects";

const ENV_VAR_PATTERNS = [
  /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g,
  /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
  /\bVITE_[A-Z0-9_]+\b/g,
];

/** Scans a project's generated code for env-var-looking references and returns unique names. */
export function detectEnvVars(project: Project): string[] {
  const sources: string[] = [project.html || "", project.css || "", project.react_code || ""];
  const pages = getProjectPages(project);
  for (const p of pages) sources.push(p.html || "");
  if (project.files && typeof project.files === "object") {
    for (const content of Object.values(project.files)) {
      if (typeof content === "string") sources.push(content);
    }
  }

  const text = sources.join("\n");
  const found = new Set<string>();

  for (const pattern of ENV_VAR_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1] || match[0];
      if (name && name.length < 80) found.add(name.replace(/^VITE_/, "VITE_"));
    }
  }

  return Array.from(found).sort();
}
