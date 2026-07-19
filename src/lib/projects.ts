export type ProjectType = "portfolio" | "dashboard" | "landing" | "generic";

export interface PageData {
  name: string;   // e.g. "index", "about", "contact"
  title: string;  // e.g. "Home", "About Us", "Contact"
  html: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  type: ProjectType;
  prompt: string;
  slug: string;
  html?: string;
  css?: string;
  react_code?: string;
  deployed_url?: string;
  is_public: boolean;
  is_multipage: boolean;
  pages?: PageData[] | null;
  view_count: number;
  created_at: string;
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export function detectProjectType(prompt: string): ProjectType {
  const lower = prompt.toLowerCase();
  if (lower.includes("portfolio")) return "portfolio";
  if (lower.includes("dashboard") || lower.includes("admin") || lower.includes("analytics")) return "dashboard";
  if (lower.includes("landing") || lower.includes("startup") || lower.includes("saas")) return "landing";
  return "generic";
}

/** Get all pages for a project, handling both single and multi-page */
export function getProjectPages(project: Project): PageData[] {
  if (project.is_multipage && project.pages && project.pages.length > 0) {
    return project.pages;
  }
  // Fallback: single page from html field
  return [{ name: "index", title: "Home", html: project.html || "" }];
}
