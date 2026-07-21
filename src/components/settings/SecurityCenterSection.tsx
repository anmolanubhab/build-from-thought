// path: src/components/settings/SecurityCenterSection.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Workspace } from "@/lib/workspaces";
import { fetchWorkspaceMembers } from "@/services/workspaces";
import SettingsCard from "./SettingsCard";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

export default function SecurityCenterSection({ workspace, currentUserId }: Props) {
  const isOwner = workspace.owner_id === currentUserId;
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [ownerCount, setOwnerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([supabase.auth.mfa.listFactors(), fetchWorkspaceMembers(workspace.id)])
      .then(([factorsResult, members]) => {
        if (cancelled) return;
        const totpFactors = factorsResult.data?.totp ?? [];
        setMfaEnabled(totpFactors.some((f) => f.status === "verified"));
        setOwnerCount(members.filter((m) => m.role === "owner").length);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  const items = [
    {
      label: "Two-factor authentication",
      satisfied: mfaEnabled,
      explanation: "Add an authenticator app for extra account security.",
      action: (
        <Link to="/dashboard/settings?section=privacy" className="text-blue-600 hover:text-blue-700 underline underline-offset-2 text-xs">
          Set up →
        </Link>
      ),
    },
    {
      label: "Workspace handle set",
      satisfied: Boolean(workspace.handle),
      explanation: "Reserved for your future public workspace page.",
    },
    {
      label: "Member credit limit configured",
      satisfied: workspace.default_member_credit_limit != null,
      explanation: "New members currently get the platform default daily limit.",
    },
    {
      label: "Workspace has a backup owner",
      satisfied: ownerCount > 1,
      explanation: "Only one owner can manage billing, members, and danger-zone actions for this workspace.",
    },
  ];

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Security center</h3>
        <p className="text-xs text-gray-500 mb-4">Security recommendations for your workspace.</p>

        {loading ? (
          <p className="text-xs text-gray-400">Checking...</p>
        ) : (
          <div>
            {items.map((item) => (
              <div key={item.label} className="flex items-start gap-2.5 py-2.5 border-b border-gray-100 last:border-b-0">
                {item.satisfied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  {!item.satisfied && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.explanation} {item.action}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
