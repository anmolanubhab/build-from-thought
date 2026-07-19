import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, RotateCcw, Eye, Undo2, Mic, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PromptEntry {
  id: string;
  text: string;
  timestamp: Date;
  status: "pending" | "success" | "error";
  summary?: string;
  changes?: string[];
}

interface PromptPanelProps {
  history: PromptEntry[];
  loading: boolean;
  onSubmit: (prompt: string, mode: "apply" | "suggest") => void;
  onUndo: () => void;
  canUndo: boolean;
}

const SUGGESTIONS = [
  "Make the header sticky with a blur background",
  "Add a dark mode toggle",
  "Improve mobile responsiveness",
  "Add smooth scroll animations",
  "Change the color scheme to blue tones",
];

export default function PromptPanel({ history, loading, onSubmit, onUndo, canUndo }: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  const handleSubmit = (mode: "apply" | "suggest" = "apply") => {
    if (!prompt.trim() || loading) return;
    onSubmit(prompt.trim(), mode);
    setPrompt("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit("apply");
    }
  };

  const useSuggestion = (s: string) => {
    setPrompt(s);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const reusePrompt = (text: string) => {
    setPrompt(text);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold">AI Editor</span>
        <div className="flex-1" />
        <button
          onClick={onUndo}
          disabled={!canUndo || loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo last change"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      </div>

      {/* Prompt History */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="w-full flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400"
        >
          {historyExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          History ({history.length})
        </button>

        {historyExpanded && (
          <div className="px-3 space-y-2 pb-3">
            {history.length === 0 && (
              <p className="text-xs text-gray-600 px-1 py-4 text-center">
                No edits yet. Type a prompt below to start editing.
              </p>
            )}
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => reusePrompt(entry.text)}
                className="w-full text-left p-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all group"
              >
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{entry.text}</p>
                {entry.summary && (
                  <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-1">✓ {entry.summary}</p>
                )}
                {entry.status === "error" && (
                  <p className="text-[11px] text-red-400 mt-1.5">✗ Failed</p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))}
            <div ref={historyEndRef} />
          </div>
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="px-3 pb-2 border-t border-gray-800 pt-2">
          <p className="text-[11px] text-gray-500 font-medium mb-1.5 px-1">Suggestions</p>
          <div className="space-y-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => useSuggestion(s)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-gray-800">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
            <span className="text-xs text-violet-300">Generating changes...</span>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 focus-within:border-violet-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !prompt && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Type your instruction to edit or create features..."
            disabled={loading}
            rows={3}
            className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 px-3 py-2.5 resize-none outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Suggestions"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSubmit("suggest")}
                disabled={!prompt.trim() || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Preview changes without applying"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={() => handleSubmit("apply")}
                disabled={!prompt.trim() || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Build
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
