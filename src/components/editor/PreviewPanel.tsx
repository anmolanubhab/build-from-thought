import { useState } from "react";
import { Code, Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageData } from "@/lib/projects";
import LivePreview from "@/components/editor/LivePreview";

interface PreviewPanelProps {
  html: string;
  css: string;
  title: string;
  pages?: PageData[];
  /** Full Next.js file map for modern projects — enables the file browser in Code view. */
  files?: Record<string, string> | null;
  previewChanges?: { summary: string; changes: string[]; html: string; css: string; pages?: PageData[]; files?: Record<string, string> | null } | null;
  onAcceptPreview?: () => void;
  onRejectPreview?: () => void;
  /** Modern (Next.js) projects only — enables the real live preview runtime in place of the static HTML approximation. Legacy (html/css-only) projects keep the static preview unchanged. */
  projectId?: string;
  /** Open draft's version id, if any — the live preview runs whatever's actually being edited, not just the last published snapshot. */
  versionId?: string | null;
  /** Applies an AI fix for a live-preview build error; return true if a fix was applied so the preview should restart. */
  onFixPreviewError?: (errorMessage: string, logTail: string) => Promise<boolean>;
}

type ViewMode = "preview" | "code";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export default function PreviewPanel({
  html, css, title, pages, files, previewChanges, onAcceptPreview, onRejectPreview,
  projectId, versionId, onFixPreviewError,
}: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [activePage, setActivePage] = useState(0);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  // Determine which pages to show
  const displayPages = previewChanges?.pages ?? pages ?? [{ name: "index", title: "Home", html: html }];
  const displayCss = previewChanges?.css ?? css;
  const isMultipage = displayPages.length > 1;

  // Modern projects: full file map for the Code view
  const displayFiles = previewChanges?.files ?? files ?? null;
  const filePaths = displayFiles ? Object.keys(displayFiles).sort() : [];
  const isModern = filePaths.length > 0;
  const currentFile = activeFile && displayFiles?.[activeFile] !== undefined
    ? activeFile
    : (filePaths.includes("app/page.tsx") ? "app/page.tsx" : filePaths[0] ?? null);

  // Clamp active page
  const currentPageIndex = Math.min(activePage, displayPages.length - 1);
  const currentPage = displayPages[currentPageIndex];

  // Build nav HTML for multi-page preview (simulated navigation)
  const currentHtml = currentPage?.html || "";

  const fullPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${displayCss}</style>
</head>
<body>${currentHtml}</body>
</html>`;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="h-11 px-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{title}</span>
        <div className="flex-1" />

        {/* Device toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {([
            { id: "desktop", icon: Monitor },
            { id: "tablet", icon: Tablet },
            { id: "mobile", icon: Smartphone },
          ] as { id: DeviceMode; icon: typeof Monitor }[]).map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                device === id ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode("preview")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "preview" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "code" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Code className="h-3 w-3" /> Code
          </button>
        </div>
      </div>

      {/* Page switcher for multi-page */}
      {isMultipage && (
        <div className="h-9 px-3 border-b border-gray-200 flex items-center gap-1 bg-gray-50 flex-shrink-0 overflow-x-auto">
          {displayPages.map((page, idx) => (
            <button
              key={page.name}
              onClick={() => setActivePage(idx)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                currentPageIndex === idx
                  ? "bg-white shadow-sm text-gray-900 border border-gray-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              {page.title || page.name}
            </button>
          ))}
        </div>
      )}

      {/* Preview changes banner */}
      {previewChanges && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800">Preview: {previewChanges.summary}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {previewChanges.changes.length} change{previewChanges.changes.length !== 1 ? "s" : ""} proposed
            </p>
          </div>
          <button
            onClick={onRejectPreview}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onAcceptPreview}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-500 transition-colors"
          >
            Accept Changes
          </button>
        </div>
      )}

      {/* Content */}
      <div className={cn("flex-1 overflow-auto bg-gray-100 flex items-start justify-center", viewMode === "preview" && isModern && !previewChanges && projectId ? "p-0" : "p-4")}>
        {viewMode === "preview" ? (
          isModern && !previewChanges && projectId ? (
            // Real, live Next.js preview — replaces the static HTML approximation for
            // modern projects. Falls back to the static render below only while an
            // unsaved "suggest" diff is being previewed (previewChanges), since that
            // content hasn't been persisted for the sandbox to pull yet.
            <div className="w-full h-full bg-white">
              <LivePreview projectId={projectId} versionId={versionId} files={files ?? null} onFixErrors={onFixPreviewError} />
            </div>
          ) : (
            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300"
              style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%", height: "100%" }}
            >
              <iframe
                srcDoc={fullPage}
                className="w-full h-full border-0"
                title="Project preview"
                sandbox="allow-scripts"
              />
            </div>
          )
        ) : isModern ? (
          <div className="w-full h-full flex gap-3">
            {/* File tree */}
            <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto">
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Project files ({filePaths.length})
              </p>
              <div className="pb-2">
                {filePaths.map((path) => (
                  <button
                    key={path}
                    onClick={() => setActiveFile(path)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors",
                      currentFile === path
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    )}
                    title={path}
                  >
                    {path}
                  </button>
                ))}
              </div>
            </div>
            {/* File content */}
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-xs font-mono text-gray-500 mb-2 px-1 truncate">{currentFile}</p>
              <pre className="flex-1 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto font-mono leading-relaxed">
                {(currentFile && displayFiles?.[currentFile]) || "// Empty file"}
              </pre>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {isMultipage ? `HTML — ${currentPage?.title || currentPage?.name}` : "HTML"}
              </h3>
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto max-h-[300px] font-mono leading-relaxed">
                {currentHtml || "<!-- No HTML -->"}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">CSS (shared)</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto max-h-[300px] font-mono leading-relaxed">
                {displayCss || "/* No CSS */"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
