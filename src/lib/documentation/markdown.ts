// path: src/lib/documentation/markdown.ts
//
// Thin markdown rendering helpers shared by the section editor's preview
// pane, search snippets, and HTML export. Sanitized with DOMPurify since
// documentation content is persisted and shown across a workspace's
// members — never trust raw markdown-to-HTML output for dangerouslySetInnerHTML.

import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

/** Heading list in document order — index-aligned with the h1-h4 elements
 *  the renderer below produces, so anchors can be attached positionally. */
export function extractToc(markdown: string): TocItem[] {
  const lines = (markdown || "").split("\n");
  const seen = new Map<string, number>();
  const items: TocItem[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.*)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`]/g, "").trim();
    let slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    items.push({ level, text, slug });
  }
  return items;
}

/** Renders markdown to sanitized HTML, with heading ids matching extractToc()'s
 *  slugs so a table-of-contents can scroll-link into the rendered preview. */
export function renderMarkdownToHtml(markdown: string): string {
  const toc = extractToc(markdown || "");
  const raw = marked.parse(markdown || "", { async: false }) as string;
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ["target", "rel"] });

  if (typeof window === "undefined" || toc.length === 0) return clean;

  try {
    const doc = new DOMParser().parseFromString(clean, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4");
    headings.forEach((h, i) => {
      if (toc[i]) h.id = toc[i].slug;
    });
    return doc.body.innerHTML;
  } catch {
    return clean;
  }
}

export function wordCount(markdown: string): number {
  return ((markdown || "").trim().match(/\S+/g) || []).length;
}

export function estimatedReadMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 200));
}
