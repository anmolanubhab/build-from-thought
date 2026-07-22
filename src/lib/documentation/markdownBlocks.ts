// path: src/lib/documentation/markdownBlocks.ts
//
// Normalizes marked's token stream into a small, stable set of block types
// that both the DOCX and PDF exporters can walk identically. Keeping this in
// one place means "support a new markdown feature in exports" is a one-file
// change instead of two divergent implementations.

import { marked } from "marked";

export type InlineRun = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type DocBlock =
  | { type: "heading"; level: number; runs: InlineRun[] }
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "list"; ordered: boolean; items: InlineRun[][] }
  | { type: "code"; text: string; lang?: string }
  | { type: "blockquote"; runs: InlineRun[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

function flattenInline(tokens: any[] | undefined, fallbackText = ""): InlineRun[] {
  if (!tokens || tokens.length === 0) return fallbackText ? [{ text: fallbackText }] : [];
  const runs: InlineRun[] = [];
  const walk = (toks: any[], bold: boolean, italic: boolean, code: boolean) => {
    for (const t of toks) {
      if (t.type === "strong") walk(t.tokens ?? [{ type: "text", raw: t.text }], true, italic, code);
      else if (t.type === "em") walk(t.tokens ?? [{ type: "text", raw: t.text }], bold, true, code);
      else if (t.type === "codespan") runs.push({ text: t.text, bold, italic, code: true });
      else if (t.type === "link" || t.type === "image") walk(t.tokens ?? [{ type: "text", raw: t.text }], bold, italic, code);
      else if (t.type === "br") runs.push({ text: "\n", bold, italic, code });
      else if (t.type === "text" || t.type === "escape") runs.push({ text: t.text ?? t.raw ?? "", bold, italic, code });
      else if (t.tokens) walk(t.tokens, bold, italic, code);
      else if (typeof t.text === "string") runs.push({ text: t.text, bold, italic, code });
    }
  };
  walk(tokens, false, false, false);
  return runs.filter((r) => r.text.length > 0);
}

function inlineToPlainText(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

/** Parses markdown into a flat list of normalized blocks (single-level lists — nested lists are flattened to their top text for export simplicity). */
export function parseMarkdownToBlocks(markdown: string): DocBlock[] {
  const tokens = marked.lexer(markdown || "");
  const blocks: DocBlock[] = [];

  const visit = (token: any) => {
    switch (token.type) {
      case "heading":
        blocks.push({ type: "heading", level: token.depth, runs: flattenInline(token.tokens, token.text) });
        break;
      case "paragraph":
        blocks.push({ type: "paragraph", runs: flattenInline(token.tokens, token.text) });
        break;
      case "list": {
        const items = (token.items || []).map((item: any) => flattenInline(item.tokens, item.text));
        blocks.push({ type: "list", ordered: !!token.ordered, items });
        break;
      }
      case "code":
        blocks.push({ type: "code", text: token.text || "", lang: token.lang });
        break;
      case "blockquote": {
        const inner = (token.tokens || []).flatMap((t: any) => flattenInline(t.tokens, t.text));
        blocks.push({ type: "blockquote", runs: inner });
        break;
      }
      case "table": {
        const header = (token.header || []).map((c: any) => inlineToPlainText(flattenInline(c.tokens, c.text)));
        const rows = (token.rows || []).map((row: any[]) => row.map((c) => inlineToPlainText(flattenInline(c.tokens, c.text))));
        blocks.push({ type: "table", header, rows });
        break;
      }
      case "hr":
        blocks.push({ type: "hr" });
        break;
      case "space":
        break;
      default:
        if (token.tokens) token.tokens.forEach(visit);
        else if (typeof token.text === "string" && token.text.trim()) {
          blocks.push({ type: "paragraph", runs: [{ text: token.text }] });
        }
    }
  };

  tokens.forEach(visit);
  return blocks;
}

export { inlineToPlainText };
