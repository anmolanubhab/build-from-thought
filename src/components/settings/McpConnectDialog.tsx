// path: src/components/settings/McpConnectDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { connectMcp } from "@/services/mcp/mcpManager";
import type { McpServerPreset } from "@/types/mcp";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** A known preset (GitHub/Stripe/Firecrawl), or omit for a custom server. */
  preset?: McpServerPreset;
  /** Present when reconnecting an existing connection (replaces its secret). */
  reconnectConnectionId?: string;
  onConnected: () => void;
}

export default function McpConnectDialog({ open, onClose, workspaceId, preset, reconnectConnectionId, onConnected }: Props) {
  const [name, setName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCustom = !preset;
  // Custom servers always show the token field, but it's optional (some MCP servers need no auth).
  // Presets that aren't GitHub (which reuses the connected GitHub account) require their key/token.
  const showTokenField = isCustom || preset?.auth_kind !== "reuse_github_token";
  const tokenRequired = !isCustom && preset?.auth_kind !== "reuse_github_token";

  useEffect(() => {
    if (open) {
      setName(preset?.name ?? "");
      setCustomUrl("");
      setToken("");
    }
  }, [open, preset]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCustom && !customUrl.trim()) return;
    if (tokenRequired && !token.trim()) return;

    setSubmitting(true);
    try {
      const connection = await connectMcp({
        workspaceId,
        serverSlug: preset?.slug,
        customUrl: isCustom ? customUrl.trim() : undefined,
        name: name.trim() || undefined,
        token: showTokenField && token.trim() ? token.trim() : undefined,
        connectionId: reconnectConnectionId,
      });
      if (connection.status === "error") {
        toast({
          title: "Saved, but the server didn't respond",
          description: connection.last_error || "Check the URL/key and try Reconnect.",
          variant: "destructive",
        });
      } else {
        toast({ title: reconnectConnectionId ? "Reconnected" : "Connected" });
      }
      onConnected();
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't connect",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = reconnectConnectionId ? `Reconnect ${preset?.name ?? "server"}` : isCustom ? "Add custom MCP server" : `Connect ${preset?.name}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {preset?.slug === "github" && "Uses the GitHub account already connected in Settings → Git."}
            {preset?.slug === "stripe" && "Paste a restricted Stripe API key (rk_...) scoped to what your tools need."}
            {preset?.slug === "firecrawl" && "Paste your Firecrawl API key."}
            {isCustom && "Any MCP server reachable over HTTPS — with a Bearer token if it requires one."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isCustom && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="mcp-name">Name</Label>
                <Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My MCP server" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mcp-url">Server URL</Label>
                <Input
                  id="mcp-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  required
                />
              </div>
            </>
          )}
          {showTokenField && (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-token">{isCustom ? "Bearer token (optional)" : "API key"}</Label>
              <Input
                id="mcp-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={isCustom ? "Leave blank if the server doesn't need one" : "Paste your key"}
                required={tokenRequired}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 text-white hover:bg-blue-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : reconnectConnectionId ? "Reconnect" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
