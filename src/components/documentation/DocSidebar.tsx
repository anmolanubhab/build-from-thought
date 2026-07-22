// path: src/components/documentation/DocSidebar.tsx
import { Search, Sparkles, Download, Sun, Moon, Keyboard } from "lucide-react";
import { DOC_SECTIONS, GROUP_LABELS } from "@/lib/documentation/registry";
import type { DocSectionKey } from "@/lib/documentation/types";
import { cn } from "@/lib/utils";
import type { WorkbenchTheme } from "@/hooks/use-workbench-theme";

export type ActiveDocView = DocSectionKey | "exports";

interface Props {
  active: ActiveDocView;
  onSelect: (view: ActiveDocView) => void;
  outdatedKeys: Set<DocSectionKey>;
  filledKeys: Set<DocSectionKey>;
  onSearch: () => void;
  onShortcuts: () => void;
  theme: WorkbenchTheme;
  onToggleTheme: () => void;
}

const GROUP_ORDER: Array<"core" | "ai-tools"> = ["core", "ai-tools"];

export default function DocSidebar({ active, onSelect, outdatedKeys, filledKeys, onSearch, onShortcuts, theme, onToggleTheme }: Props) {
  return (
    <div className="h-full flex flex-col wb-sans" style={{ background: "var(--wb-surface)" }}>
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
        <Sparkles className="h-4 w-4" style={{ color: "var(--wb-circuit)" }} />
        <span className="text-sm font-semibold wb-display" style={{ color: "var(--wb-text)" }}>Documentation</span>
      </div>

      <button
        onClick={onSearch}
        className="mx-3 mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs shrink-0 border transition-colors"
        style={{ borderColor: "var(--wb-line)", color: "var(--wb-text-muted)", background: "var(--wb-canvas)" }}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search docs…</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded border" style={{ borderColor: "var(--wb-line)" }}>⌘K</kbd>
      </button>

      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--wb-text-muted)" }}>
              {GROUP_LABELS[group]}
            </p>
            <div className="space-y-0.5">
              {DOC_SECTIONS.filter((s) => s.group === group).map((s) => {
                const isActive = active === s.key;
                const isOutdated = outdatedKeys.has(s.key);
                const isFilled = filledKeys.has(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => onSelect(s.key)}
                    title={s.description}
                    className={cn("w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left")}
                    style={{
                      background: isActive ? "var(--wb-surface-raised)" : "transparent",
                      color: isActive ? "var(--wb-text)" : "var(--wb-text-muted)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{s.label}</span>
                    {isOutdated && (
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#F59E0B" }} title="Outdated — project changed since last generation" />
                    )}
                    {!isOutdated && isFilled && (
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--wb-circuit)" }} title="Up to date" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--wb-text-muted)" }}>
            Exports
          </p>
          <button
            onClick={() => onSelect("exports")}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left"
            style={{
              background: active === "exports" ? "var(--wb-surface-raised)" : "transparent",
              color: active === "exports" ? "var(--wb-text)" : "var(--wb-text-muted)",
              fontWeight: active === "exports" ? 600 : 400,
            }}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="truncate">Exports</span>
          </button>
        </div>
      </nav>

      <div className="px-2 pb-3 pt-2 border-t flex items-center gap-1" style={{ borderColor: "var(--wb-line)" }}>
        <button
          onClick={onToggleTheme}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors"
          style={{ color: "var(--wb-text-muted)" }}
          title="Toggle dark / light mode"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          onClick={onShortcuts}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors"
          style={{ color: "var(--wb-text-muted)" }}
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" /> Shortcuts
        </button>
      </div>
    </div>
  );
}
