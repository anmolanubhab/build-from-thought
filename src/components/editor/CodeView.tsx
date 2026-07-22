// path: src/components/editor/CodeView.tsx
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PageData } from "@/lib/projects";

interface Props {
  html: string;
  css: string;
  pages?: PageData[];
  files?: Record<string, string> | null;
}

/** Full-width code browser — promoted out of PreviewPanel's old inline toggle
 *  now that "Code" is its own top-level project tab. */
export default function CodeView({ html, css, pages, files }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);

  const filePaths = files ? Object.keys(files).sort() : [];
  const isModern = filePaths.length > 0;
  const currentFile = activeFile && files?.[activeFile] !== undefined
    ? activeFile
    : (filePaths.includes("app/page.tsx") ? "app/page.tsx" : filePaths[0] ?? null);

  const displayPages = pages && pages.length > 0 ? pages : [{ name: "index", title: "Home", html }];
  const isMultipage = displayPages.length > 1;
  const currentPageIndex = Math.min(activePage, displayPages.length - 1);
  const currentPage = displayPages[currentPageIndex];

  if (isModern) {
    return (
      <div className="h-full w-full flex gap-3 p-4 bg-gray-100">
        <div className="w-64 shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto">
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
                  currentFile === path ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                )}
                title={path}
              >
                {path}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-xs font-mono text-gray-500 mb-2 px-1 truncate">{currentFile}</p>
          <pre className="flex-1 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto font-mono leading-relaxed">
            {(currentFile && files?.[currentFile]) || "// Empty file"}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-gray-100 p-4">
      {isMultipage && (
        <div className="flex items-center gap-1 mb-3 overflow-x-auto">
          {displayPages.map((page, idx) => (
            <button
              key={page.name}
              onClick={() => setActivePage(idx)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                currentPageIndex === idx ? "bg-white shadow-sm text-gray-900 border border-gray-200" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
              )}
            >
              {page.title || page.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            {isMultipage ? `HTML — ${currentPage?.title || currentPage?.name}` : "HTML"}
          </h3>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto max-h-[400px] font-mono leading-relaxed">
            {currentPage?.html || "<!-- No HTML -->"}
          </pre>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">CSS (shared)</h3>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto max-h-[400px] font-mono leading-relaxed">
            {css || "/* No CSS */"}
          </pre>
        </div>
      </div>
    </div>
  );
}
