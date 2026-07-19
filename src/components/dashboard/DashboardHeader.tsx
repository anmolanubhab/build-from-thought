// path: src/components/dashboard/DashboardHeader.tsx
import { Send, FileText, Files, Zap } from "lucide-react";

interface DashboardHeaderProps {
  userName: string;
  prompt: string;
  generating: boolean;
  isMultipage: boolean;
  onPromptChange: (v: string) => void;
  onGenerate: () => void;
  onToggleMultipage: (v: boolean) => void;
}

export default function DashboardHeader({
  userName,
  prompt,
  generating,
  isMultipage,
  onPromptChange,
  onGenerate,
  onToggleMultipage,
}: DashboardHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="relative overflow-hidden wb-blueprint-grid" style={{ background: "var(--wb-canvas)" }}>
      <div className="px-6 pt-14 pb-16 md:pt-20 md:pb-24 text-center relative">
        <p className="wb-mono text-[11px] tracking-[0.2em] uppercase mb-3" style={{ color: "var(--wb-circuit)" }}>
          Workbench // Ready to build
        </p>
        <h1 className="wb-display text-2xl md:text-4xl font-semibold mb-8" style={{ color: "var(--wb-text)" }}>
          Got an idea, {userName}?
        </h1>

        {/* SPA / Multi-page toggle */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          <button
            onClick={() => onToggleMultipage(false)}
            className="wb-mono flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide transition-colors border"
            style={{
              background: !isMultipage ? "var(--wb-surface-raised)" : "transparent",
              borderColor: !isMultipage ? "var(--wb-circuit)" : "var(--wb-line)",
              color: !isMultipage ? "var(--wb-circuit)" : "var(--wb-text-muted)",
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Single Page
          </button>
          <button
            onClick={() => onToggleMultipage(true)}
            className="wb-mono flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide transition-colors border"
            style={{
              background: isMultipage ? "var(--wb-surface-raised)" : "transparent",
              borderColor: isMultipage ? "var(--wb-circuit)" : "var(--wb-line)",
              color: isMultipage ? "var(--wb-circuit)" : "var(--wb-text-muted)",
            }}
          >
            <Files className="h-3.5 w-3.5" />
            Multi Page
          </button>
        </div>

        {/* Ignition console */}
        <div className="max-w-2xl mx-auto">
          <div
            className="wb-console-glow rounded-2xl flex items-center gap-3 px-5 py-4 border transition-shadow"
            style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
          >
            <span className="wb-mono text-sm flex-shrink-0" style={{ color: "var(--wb-circuit)" }}>{">"}</span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMultipage
                  ? "Describe your website... e.g. 'A portfolio site with about and contact pages'"
                  : "Ask WebdevsAI to create a landing page for my..."
              }
              className="wb-sans flex-1 text-sm outline-none bg-transparent placeholder:opacity-60"
              style={{ color: "var(--wb-text)" }}
              disabled={generating}
            />
            {!generating && <span className="wb-cursor wb-mono text-sm flex-shrink-0" style={{ color: "var(--wb-text-muted)" }}>_</span>}
            <button
              onClick={onGenerate}
              disabled={generating || !prompt.trim()}
              className="p-2.5 rounded-xl text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{ background: "var(--wb-ember)" }}
              title="Generate"
            >
              {generating ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
              ) : (
                <Zap className="h-4 w-4" fill="white" />
              )}
            </button>
          </div>

          {isMultipage && (
            <p className="wb-mono mt-3 text-[11px]" style={{ color: "var(--wb-text-muted)" }}>
              Multi-page mode: generates separate HTML files (Home, About, Contact, etc.) with shared navigation
            </p>
          )}
        </div>

        {generating && (
          <p className="wb-mono mt-4 text-xs animate-pulse" style={{ color: "var(--wb-ember)" }}>
            ⚡ Generating your {isMultipage ? "multi-page website" : "app"}... This may take 10-20 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
