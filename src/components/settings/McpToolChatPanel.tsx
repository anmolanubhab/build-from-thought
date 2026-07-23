// path: src/components/settings/McpToolChatPanel.tsx
// "Try your tools" — the AI Tool Planner made visible/testable, without
// touching the main app-generation prompt bar. The AI decides which
// connected tools to use; nothing here is manually selected.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SettingsCard from "./SettingsCard";
import { chatWithMcpTools } from "@/services/mcp/mcpManager";
import { toast } from "@/hooks/use-toast";
import type { McpChatToolTrace, McpTool } from "@/types/mcp";
import { ChevronDown, ChevronRight, Loader2, Send, Wrench } from "lucide-react";

interface Props {
  workspaceId: string;
  tools: McpTool[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  trace?: McpChatToolTrace[];
}

export default function McpToolChatPanel({ workspaceId, tools }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<number | null>(null);

  const uniqueToolNames = Array.from(new Set(tools.map((t) => t.name)));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setSending(true);
    try {
      const response = await chatWithMcpTools(workspaceId, message);
      setMessages((prev) => [...prev, { role: "assistant", text: response.answer, trace: response.trace }]);
    } catch (err) {
      toast({
        title: "Couldn't get a response",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsCard>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Try your tools</h3>
      <p className="text-xs text-gray-500 mb-3">
        Ask something — the AI picks which connected tools to use automatically.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {uniqueToolNames.length === 0 ? (
          <span className="text-xs text-gray-400">No tools available yet — connect a server above.</span>
        ) : (
          uniqueToolNames.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
              <Wrench className="h-2.5 w-2.5" /> {name}
            </span>
          ))
        )}
      </div>

      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto -mx-1 px-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm text-left whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                {m.text}
              </div>
              {m.role === "assistant" && m.trace && m.trace.length > 0 && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedTrace(expandedTrace === i ? null : i)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {expandedTrace === i ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {m.trace.length} tool call{m.trace.length > 1 ? "s" : ""}
                  </button>
                  {expandedTrace === i && (
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {m.trace.map((t, ti) => (
                        <li key={ti} className={`text-xs ${t.status === "error" ? "text-red-600" : "text-gray-500"}`}>
                          {t.connection_name} → {t.tool_name} {t.status === "error" ? `(failed: ${t.summary})` : "✓"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI to use a connected tool..."
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="bg-blue-600 text-white hover:bg-blue-700 shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </SettingsCard>
  );
}
