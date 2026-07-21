// path: src/components/settings/WorkspaceDomainsSection.tsx
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/workspaces";
import { fetchWorkspaceDomains, type WorkspaceDomain } from "@/services/workspaceDomains";
import SettingsCard from "./SettingsCard";

interface Props {
  workspace: Workspace;
}

export default function WorkspaceDomainsSection({ workspace }: Props) {
  const [domains, setDomains] = useState<WorkspaceDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchWorkspaceDomains(workspace.id)
      .then(setDomains)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace.id]);

  const statusBadge = (status: string) => {
    if (status === "verified") {
      return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Verified</span>;
    }
    if (status === "pending") {
      return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
    }
    return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{status === "misconfigured" ? "Misconfigured" : "Error"}</span>;
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Workspace domains</h3>
        <p className="text-xs text-gray-500 mb-4">
          Custom domains across every project in this workspace. Domains are still added and managed per-project, from each project's Deploy menu.
        </p>
        <div>
          {loading && <p className="text-sm text-gray-400 text-center py-6">Loading domains...</p>}
          {!loading && domains.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No custom domains configured yet. Add one from any project's Deploy menu.</p>
          )}
          {!loading && domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
              <div className="min-w-0">
                <p className="font-mono text-sm text-gray-900 truncate">{d.domain}</p>
                <p className="text-xs text-gray-500 truncate">on {d.project.title}</p>
              </div>
              <div className="shrink-0">{statusBadge(d.status)}</div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
