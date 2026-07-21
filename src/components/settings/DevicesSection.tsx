// path: src/components/settings/DevicesSection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ConnectedApp, ConnectedAppProvider } from "@/services/deviceConnections";
import { fetchConnectedApps, disconnectApp } from "@/services/deviceConnections";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import { Boxes } from "lucide-react";

const PROVIDER_NAMES: Record<ConnectedAppProvider, string> = {
  github: "GitHub",
  vercel: "Vercel",
  netlify: "Netlify",
  supabase: "Supabase",
};

function formatConnectedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DevicesSection() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingProvider, setDisconnectingProvider] = useState<ConnectedAppProvider | null>(null);

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    fetchConnectedApps(user.id)
      .then(setApps)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDisconnect = async (provider: ConnectedAppProvider) => {
    if (!user) return;
    setDisconnectingProvider(provider);
    try {
      await disconnectApp(provider, user.id);
      toast({ title: `${PROVIDER_NAMES[provider]} disconnected` });
      refresh();
    } catch (err) {
      toast({
        title: `Couldn't disconnect ${PROVIDER_NAMES[provider]}`,
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDisconnectingProvider(null);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Connected apps</h3>
        <p className="text-xs text-gray-500 mb-4">Third-party accounts linked to WebdevsAI.</p>

        {loading && <p className="text-sm text-gray-400 text-center py-6">Loading connected apps...</p>}

        {!loading && apps.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No connected apps yet. Connect GitHub, Vercel, Netlify, or Supabase from the Resources page.
          </p>
        )}

        {!loading && apps.length > 0 && (
          <div className="space-y-1">
            {apps.map((app) => (
              <div
                key={app.provider}
                className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Boxes className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {PROVIDER_NAMES[app.provider]} &middot; {app.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Connected {formatConnectedAt(app.connectedAt)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
                  disabled={disconnectingProvider === app.provider}
                  onClick={() => handleDisconnect(app.provider)}
                >
                  {disconnectingProvider === app.provider ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
