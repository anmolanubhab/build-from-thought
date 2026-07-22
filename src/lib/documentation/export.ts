// path: src/lib/documentation/export.ts
//
// Export System: Markdown, HTML, PDF, DOCX, Print, and GitHub README. Every
// format is generated CLIENT-SIDE from the section's own markdown — no
// server round-trip, no placeholder "coming soon" exports.

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { renderMarkdownToHtml } from "./markdown";
import { parseMarkdownToBlocks, inlineToPlainText, type DocBlock, type InlineRun } from "./markdownBlocks";

export interface ExportableDoc {
  title: string;
  content_md: string;
}

function slugFilename(base: string): string {
  return base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function downloadMarkdown(doc: ExportableDoc, filenameBase: string): void {
  const blob = new Blob([doc.content_md], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${slugFilename(filenameBase)}.md`);
}

// ---------------------------------------------------------------------------
// HTML (also backs Print — a print stylesheet + window.print())
// ---------------------------------------------------------------------------

function buildStandaloneHtml(doc: ExportableDoc): string {
  const body = renderMarkdownToHtml(doc.content_md);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${doc.title}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 860px; margin: 0 auto; padding: 48px 24px; color: #1a1d23; line-height: 1.65; }
  h1, h2, h3, h4 { font-family: 'Space Grotesk', 'Inter', sans-serif; line-height: 1.3; margin-top: 2em; margin-bottom: 0.5em; }
  h1 { font-size: 2rem; border-bottom: 2px solid #e1ded3; padding-bottom: 0.3em; }
  h2 { font-size: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.25em; }
  h3 { font-size: 1.2rem; }
  code { background: #f3f2ed; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #171b22; color: #eceef1; padding: 16px; border-radius: 10px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e1ded3; padding: 8px 12px; text-align: left; }
  th { background: #f7f5f0; }
  blockquote { border-left: 3px solid #7c3aed; margin: 1em 0; padding: 0.25em 1em; color: #555; }
  a { color: #2563eb; }
  img { max-width: 100%; border-radius: 8px; }
  @media print {
    body { padding: 0; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function downloadHtml(doc: ExportableDoc, filenameBase: string): void {
  const html = buildStandaloneHtml(doc);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  triggerDownload(blob, `${slugFilename(filenameBase)}.html`);
}

export function printDocument(doc: ExportableDoc): void {
  const html = buildStandaloneHtml(doc);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the new document a tick to paint before invoking print.
  win.addEventListener("load", () => {
    win.focus();
    win.print();
  });
  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* window may already be closed */ }
  }, 400);
}

// ---------------------------------------------------------------------------
// GitHub README — special-cased export: still a plain .md download, but the
// caller (ExportMenu) also offers "sync into project files" so the next
// GitHub push / ZIP download carries the up-to-date README.md at repo root.
// ---------------------------------------------------------------------------

export function downloadReadme(doc: ExportableDoc): void {
  const blob = new Blob([doc.content_md], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, "README.md");
}

// ---------------------------------------------------------------------------
// PDF (jsPDF, laid out directly from markdown blocks — no headless browser)
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 48;

export async function downloadPdf(doc: ExportableDoc, filenameBase: string): Promise<void> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - PAGE_MARGIN) {
      pdf.addPage();
      y = PAGE_MARGIN;
    }
  };

  const writeWrapped = (text: string, size: number, style: "normal" | "bold" | "italic" = "normal", indent = 0, color: [number, number, number] = [26, 29, 35]) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines: string[] = pdf.splitTextToSize(text, usableWidth - indent);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, PAGE_MARGIN + indent, y);
      y += lineHeight;
    }
  };

  pdf.setDocumentProperties({ title: doc.title });
  writeWrapped(doc.title, 22, "bold");
  y += 6;

  const blocks = parseMarkdownToBlocks(doc.content_md);
  const HEADING_SIZES: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 11.5 };

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        y += 10;
        writeWrapped(inlineToPlainText(block.runs), HEADING_SIZES[block.level] ?? 11, "bold");
        y += 2;
        break;
      }
      case "paragraph": {
        writeWrapped(inlineToPlainText(block.runs), 10.5, "normal");
        y += 6;
        break;
      }
      case "list": {
        block.items.forEach((item, i) => {
          const prefix = block.ordered ? `${i + 1}. ` : "•  ";
          writeWrapped(`${prefix}${inlineToPlainText(item)}`, 10.5, "normal", 14);
        });
        y += 6;
        break;
      }
      case "blockquote": {
        writeWrapped(inlineToPlainText(block.runs), 10.5, "italic", 14, [90, 90, 90]);
        y += 6;
        break;
      }
      case "code": {
        const lines = block.text.split("\n");
        const lineHeight = 9 * 1.4;
        ensureSpace(lineHeight * Math.min(lines.length, 2) + 12);
        const boxStart = y;
        pdf.setFont("courier", "normal");
        pdf.setFontSize(9);
        for (const line of lines) {
          ensureSpace(lineHeight);
          pdf.text(line, PAGE_MARGIN + 8, y);
          y += lineHeight;
        }
        pdf.setDrawColor(225, 222, 211);
        pdf.roundedRect(PAGE_MARGIN, boxStart - 10, usableWidth, y - boxStart + 6, 3, 3);
        y += 10;
        break;
      }
      case "table": {
        ensureSpace(20);
        autoTable(pdf, {
          startY: y,
          margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
          head: [block.header],
          body: block.rows,
          styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
          headStyles: { fillColor: [37, 99, 235] },
        });
        // @ts-expect-error — jspdf-autotable augments the instance at runtime
        y = (pdf.lastAutoTable?.finalY ?? y) + 14;
        break;
      }
      case "hr": {
        ensureSpace(16);
        pdf.setDrawColor(225, 222, 211);
        pdf.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
        y += 16;
        break;
      }
    }
  }

  pdf.save(`${slugFilename(filenameBase)}.pdf`);
}

// ---------------------------------------------------------------------------
// DOCX (docx package — laid out directly from markdown blocks)
// ---------------------------------------------------------------------------

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

function runsToTextRuns(runs: InlineRun[]): TextRun[] {
  if (runs.length === 0) return [new TextRun("")];
  return runs.map((r) => new TextRun({
    text: r.text,
    bold: r.bold,
    italics: r.italic,
    font: r.code ? "Courier New" : undefined,
  }));
}

function blockToDocxElements(block: DocBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case "heading":
      return [new Paragraph({ heading: HEADING_MAP[block.level] ?? HeadingLevel.HEADING_4, children: runsToTextRuns(block.runs) })];
    case "paragraph":
      return [new Paragraph({ spacing: { after: 160 }, children: runsToTextRuns(block.runs) })];
    case "list":
      return block.items.map((item, i) => new Paragraph({
        bullet: block.ordered ? undefined : { level: 0 },
        numbering: block.ordered ? { reference: "doc-numbering", level: 0 } : undefined,
        spacing: { after: 60 },
        children: runsToTextRuns(item),
      }));
    case "blockquote":
      return [new Paragraph({
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "7C3AED", space: 8 } },
        children: block.runs.map((r) => new TextRun({ text: r.text, italics: true })),
      })];
    case "code":
      return block.text.split("\n").map((line) => new Paragraph({
        shading: { fill: "F3F2ED" },
        children: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })],
      }));
    case "hr":
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E1DED3" } } })];
    case "table":
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: block.header.map((h) => new TableCell({
              shading: { fill: "2563EB" },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
            })),
          }),
          ...block.rows.map((row) => new TableRow({
            children: row.map((cell) => new TableCell({ children: [new Paragraph(cell)] })),
          })),
        ],
      })];
    default:
      return [];
  }
}

export async function downloadDocx(doc: ExportableDoc, filenameBase: string): Promise<void> {
  const blocks = parseMarkdownToBlocks(doc.content_md);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.title)] }),
    ...blocks.flatMap(blockToDocxElements),
  ];

  const document = new Document({
    numbering: { config: [{ reference: "doc-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }] },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(document);
  triggerDownload(blob, `${slugFilename(filenameBase)}.docx`);
}

// ---------------------------------------------------------------------------
// Bundle export — "Export All Documentation" from the Exports sidebar entry.
// ---------------------------------------------------------------------------

export function buildBundleMarkdown(sections: { title: string; content_md: string }[]): string {
  return sections
    .filter((s) => s.content_md.trim().length > 0)
    .map((s) => s.content_md.trim())
    .join("\n\n---\n\n");
}
