// path: src/components/settings/AuditLogSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import { fetchAuditLog, type AuditLogEntry } from "@/services/auditLog";
import SettingsCard from "./SettingsCard";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

export default function AuditLogSection({ workspace, currentUserId }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = workspace.owner_id === currentUserId;

  useEffect(() => {
    if (!isOwner) return;
    setLoading(true);
    fetchAuditLog(workspace.id)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace.id, isOwner]);

  if (!isOwner) {
    return (
      <div className="space-y-5">
        <SettingsCard>
          <p className="text-sm text-gray-400 text-center py-6">
            Only the workspace owner can view the audit log.
          </p>
        </SettingsCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Audit logs</h3>
        <p className="text-xs text-gray-500 mb-4">A history of security-relevant actions in your workspace.</p>
        <div className="space-y-1">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading audit log...</p>}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No audit events recorded yet.</p>
          )}
          {!loading && entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-gray-900 shrink-0">{entry.actorLabel}</span>
                <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 truncate">
                  {entry.action}
                </code>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
