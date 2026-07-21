// path: src/components/settings/IdentitySection.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";

export default function IdentitySection() {
  const { user } = useAuth();
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCreatedAt = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const raw = data.user?.created_at;
      setCreatedAt(
        raw
          ? new Date(raw).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
          : "Unknown"
      );
    };
    loadCreatedAt();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestSso = () => {
    toast({ title: "Noted — we'll follow up about enterprise SSO." });
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Login method</h3>
        <p className="text-xs text-gray-500 mb-4">How you currently sign in to WebdevsAI.</p>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Email</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Sign-in method</p>
            <p className="text-xs text-gray-500 mt-0.5">Email &amp; password</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Account created</p>
            <p className="text-xs text-gray-500 mt-0.5">{createdAt ?? "—"}</p>
          </div>
          <p className="text-xs text-gray-500">
            Want an extra layer of security?{" "}
            <Link
              to="/dashboard/settings?section=privacy"
              className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Set up two-factor authentication →
            </Link>
          </p>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Single sign-on (SSO)</h3>
        <p className="text-xs text-gray-500 mb-4">Enterprise identity provider integration.</p>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            SSO requires connecting an external identity provider (Okta, Azure AD, Google Workspace, etc.) at the
            organization level. This isn't set up for your workspace yet.
          </p>
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 hover:bg-gray-50"
            onClick={requestSso}
          >
            Request SSO for my organization
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
