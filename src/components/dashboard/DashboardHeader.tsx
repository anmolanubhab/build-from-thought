// path: src/components/dashboard/DashboardHeader.tsx
import { Send, FileText, Files } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-none">
      {/* Gradient Background */}
      <div
        className="px-6 pt-12 pb-16 md:pt-16 md:pb-20 text-center"
        style={{
          background: "linear-gradient(135deg, #f472b6 0%, #fb923c 30%, #e879f9 60%, #a78bfa 100%)",
        }}
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-6">
          Got an idea, {userName}?
        </h1>

        {/* SPA / Multi-page toggle */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => onToggleMultipage(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !isMultipage
                ? "bg-white/90 text-gray-900 shadow-sm"
                : "bg-white/30 text-white hover:bg-white/40"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Single Page
          </button>
          <button
            onClick={() => onToggleMultipage(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMultipage
                ? "bg-white/90 text-gray-900 shadow-sm"
                : "bg-white/30 text-white hover:bg-white/40"
            }`}
          >
            <Files className="h-3.5 w-3.5" />
            Multi Page
          </button>
        </div>

        {/* Prompt Input */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg flex items-center gap-2 px-4 py-3">
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
              className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
              disabled={generating}
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onGenerate}
                disabled={generating || !prompt.trim()}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {isMultipage && (
            <p className="mt-2 text-xs text-white/80">
              Multi-page mode: generates separate HTML files (Home, About, Contact, etc.) with shared navigation
            </p>
          )}
        </div>

        {generating && (
          <p className="mt-4 text-sm text-white/90 animate-pulse font-medium">
            ✨ Generating your {isMultipage ? "multi-page website" : "app"}... This may take 10-20 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
