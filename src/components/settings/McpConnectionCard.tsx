// path: src/components/settings/McpConnectionCard.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { McpConnection } from "@/types/mcp";

interface Props {
  title: string;
  subtitle?: string | null;
  docUrl?: string | null;
  connection?: McpConnection;
  toolCount?: number;
  isOwner: boolean;
  busy: boolean;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onRefreshTools: () => void;
  editorCanExecute?: boolean;
  onToggleEditorAccess?: (value: boolean) => void;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

export default function McpConnectionCard({
  title, subtitle, docUrl, connection, toolCount, isOwner, busy,
  onConnect, onReconnect, onDisconnect, onRefreshTools,
  editorCanExecute, onToggleEditorAccess,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {connection?.status === "connected" && (
          <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5" /> Connected
          </Badge>
        )}
        {connection?.status === "error" && (
          <Badge variant="secondary" className="gap-1 text-[10px] bg-red-50 text-red-700 border border-red-200">
            <XCircle className="h-2.5 w-2.5" /> Error
          </Badge>
        )}
      </div>

      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {docUrl && (
        <a href={docUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mb-3 -mt-2">
          Documentation
        </a>
      )}

      {connection ? (
        <div className="mt-auto space-y-2">
          {connection.status === "error" && connection.last_error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">{connection.last_error}</p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{toolCount ?? 0} tools</span>
            <span>Last sync: {formatDate(connection.last_sync_at)}</span>
          </div>
          {isOwner && onToggleEditorAccess && (
            <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
              <span>Editors can use this</span>
              <Switch checked={!!editorCanExecute} onCheckedChange={onToggleEditorAccess} className="scale-75" />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button variant="outline" size="sm" onClick={onRefreshTools} disabled={busy} className="gap-1 text-xs h-7 px-2">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
            </Button>
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={onReconnect} disabled={busy} className="text-xs h-7 px-2">
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" onClick={onDisconnect} disabled={busy} className="text-xs h-7 px-2 text-red-600 hover:text-red-600 hover:bg-red-50">
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-auto">
          {isOwner ? (
            <Button size="sm" onClick={onConnect} disabled={busy} className="w-full bg-blue-600 text-white hover:bg-blue-700">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1.5">Only the workspace owner can connect</p>
          )}
        </div>
      )}
    </div>
  );
}
