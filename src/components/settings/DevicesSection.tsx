// path: src/components/settings/DevicesSection.tsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ConnectedApp, ConnectedAppProvider } from "@/services/deviceConnections";
import { fetchConnectedApps, disconnectApp } from "@/services/deviceConnections";
import type { MessagingConnection, MessagingProvider } from "@/services/messaging";
import { fetchMessagingConnections, startTelegramLink, disconnectMessaging } from "@/services/messaging";
import type { DesktopDevice } from "@/services/desktopDevices";
import { fetchDesktopDevices, disconnectDesktopDevice } from "@/services/desktopDevices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";
import {
  Boxes, Send, MessageCircle, Laptop, Monitor, Apple, Terminal, Check, Loader2,
  ExternalLink, Smartphone, QrCode, Bell, MonitorSmartphone, GitBranch, Zap, Cloud,
} from "lucide-react";

const PROVIDER_NAMES: Record<ConnectedAppProvider, string> = {
  github: "GitHub",
  vercel: "Vercel",
  netlify: "Netlify",
  supabase: "Supabase",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Messaging Apps                                                      */
/* ------------------------------------------------------------------ */

function ConnectedBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-medium">Connected</Badge>
  ) : (
    <Badge variant="outline" className="border-gray-200 text-gray-500 font-medium">Not Connected</Badge>
  );
}

function TelegramConnectDialog({
  open, onClose, onConnected,
}: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setDeepLink(null);
    setCode(null);

    startTelegramLink()
      .then((info) => {
        setDeepLink(info.deepLink);
        setCode(info.code);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't start the Telegram connection."))
      .finally(() => setLoading(false));

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !code) return;
    // Poll for the webhook flipping our connection to "connected" once the user taps Start in Telegram.
    pollRef.current = window.setInterval(async () => {
      onConnected();
    }, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Telegram</DialogTitle>
          <DialogDescription>
            Tap the button below to open Telegram, then press <strong>Start</strong> in the chat with our bot to finish linking.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing your link...
            </div>
          )}
          {error && <p className="text-sm text-red-600 py-4">{error}</p>}
          {deepLink && !error && (
            <div className="space-y-4">
              <a href={deepLink} target="_blank" rel="noreferrer">
                <Button className="w-full bg-[#26A5E4] hover:bg-[#1e8ec9] text-white gap-2">
                  <Send className="h-4 w-4" /> Open Telegram <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <p className="text-xs text-gray-400 text-center">
                Code: <span className="font-mono text-gray-600">{code}</span> · waiting for confirmation...
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessagingAppsCard({
  connections, onRefresh,
}: { connections: Record<MessagingProvider, MessagingConnection> | null; onRefresh: () => void }) {
  const { user } = useAuth();
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState<MessagingProvider | null>(null);

  const telegram = connections?.telegram;
  const whatsapp = connections?.whatsapp;

  const handleDisconnect = async (provider: MessagingProvider) => {
    if (!user) return;
    setDisconnecting(provider);
    try {
      await disconnectMessaging(provider, user.id);
      toast({ title: `${provider === "telegram" ? "Telegram" : "WhatsApp"} disconnected` });
      onRefresh();
    } catch (err) {
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <SettingsCard className="shadow-sm">
      <h3 className="font-display text-base font-bold text-gray-900 mb-1">Messaging Apps</h3>
      <p className="text-sm text-gray-500 mb-5">
        Connect messaging platforms to receive project notifications, AI build updates, deployment alerts, and chat with WebdevsAI directly.
      </p>

      <div className="space-y-3">
        {/* Telegram */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#26A5E4]/10 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5 text-[#26A5E4]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-gray-900">Telegram</p>
                <ConnectedBadge connected={telegram?.status === "connected"} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Link your Telegram account to receive project updates, deployment notifications, AI responses, and chat with WebdevsAI directly.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {telegram?.status === "connected" ? (
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={disconnecting === "telegram"}
                onClick={() => handleDisconnect("telegram")}
              >
                {disconnecting === "telegram" ? "Disconnecting..." : "Disconnect"}
              </Button>
            ) : (
              <Button className="bg-gray-900 hover:bg-gray-800 text-white" onClick={() => setTelegramDialogOpen(true)}>
                Connect Telegram
              </Button>
            )}
          </div>
        </div>

        {/* WhatsApp — UI-ready placeholder, real Cloud API integration is on the roadmap */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-gray-900">WhatsApp</p>
                <ConnectedBadge connected={whatsapp?.status === "connected"} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Connect WhatsApp Business to receive notifications, deployment status, build logs, AI conversations, and quick project access.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              variant="outline"
              className="border-gray-200 text-gray-500 hover:bg-gray-50"
              onClick={() => toast({ title: "Coming soon", description: "WhatsApp Business (Cloud API) support is on the roadmap." })}
            >
              Connect WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <TelegramConnectDialog
        open={telegramDialogOpen}
        onClose={() => setTelegramDialogOpen(false)}
        onConnected={() => {
          onRefresh();
        }}
      />
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Connected accounts (existing GitHub/Vercel/Netlify/Supabase)         */
/* ------------------------------------------------------------------ */

function ConnectedAccountsCard() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingProvider, setDisconnectingProvider] = useState<ConnectedAppProvider | null>(null);

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    fetchConnectedApps(user.id).then(setApps).catch(() => {}).finally(() => setLoading(false));
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
    <SettingsCard className="shadow-sm">
      <h3 className="font-display text-base font-bold text-gray-900 mb-1">Connected Accounts</h3>
      <p className="text-sm text-gray-500 mb-4">Third-party accounts linked to WebdevsAI for git, deploys, and databases.</p>

      {loading && <p className="text-sm text-gray-400 text-center py-6">Loading connected accounts...</p>}
      {!loading && apps.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          No connected accounts yet. Connect GitHub, Vercel, Netlify, or Supabase from the Resources page.
        </p>
      )}
      {!loading && apps.length > 0 && (
        <div className="space-y-1">
          {apps.map((app) => (
            <div key={app.provider} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Boxes className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{PROVIDER_NAMES[app.provider]} &middot; {app.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Connected {formatDate(app.connectedAt)}</p>
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
  );
}

/* ------------------------------------------------------------------ */
/* Desktop Apps showcase                                                */
/* ------------------------------------------------------------------ */

const DESKTOP_FEATURES = [
  { icon: Zap, label: "Local MCP Support" },
  { icon: GitBranch, label: "Git Integration" },
  { icon: Cloud, label: "Offline Mode" },
  { icon: Boxes, label: "Project Sync" },
  { icon: MessageCircle, label: "AI Assistant" },
  { icon: Monitor, label: "Faster Build Performance" },
];

function DesktopShowcaseCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-6 md:p-8">
          <h3 className="font-display text-lg font-bold text-gray-900 mb-2">WebdevsAI Desktop</h3>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Work locally with secure project syncing, Git integration, local AI tools, MCP support, offline workflows, and faster development.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {DESKTOP_FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <f.icon className="h-3.5 w-3.5 text-blue-600" />
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full md:w-72 shrink-0 bg-gradient-to-br from-blue-500 to-cyan-400 relative flex items-center justify-center p-8 min-h-[180px]">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
          <div className="relative w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl">
            <MonitorSmartphone className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Downloads                                                            */
/* ------------------------------------------------------------------ */

interface DownloadTarget {
  key: string;
  name: string;
  description: string;
  icon: typeof Monitor;
  available: boolean;
}

const DOWNLOAD_TARGETS: DownloadTarget[] = [
  { key: "windows", name: "Windows", description: "Windows 10 & Windows 11 (64-bit)", icon: Monitor, available: true },
  { key: "mac-arm", name: "macOS (Apple Silicon)", description: "For Apple M1, M2, M3, and newer chips.", icon: Apple, available: true },
  { key: "mac-intel", name: "macOS (Intel)", description: "For Intel-based Macs.", icon: Apple, available: true },
  { key: "linux", name: "Linux", description: "Ubuntu, Debian, Fedora, Arch.", icon: Terminal, available: false },
];

function DownloadsCard() {
  const handleDownload = (target: DownloadTarget) => {
    if (!target.available) return;
    toast({ title: "Coming soon", description: `The ${target.name} installer isn't published yet — check back shortly.` });
  };

  return (
    <SettingsCard className="shadow-sm">
      <h3 className="font-display text-base font-bold text-gray-900 mb-1">All Downloads</h3>
      <p className="text-sm text-gray-500 mb-4">Download the installer that matches your operating system.</p>

      <div className="space-y-1">
        {DOWNLOAD_TARGETS.map((target) => (
          <div key={target.key} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                <target.icon className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{target.name}</p>
                <p className="text-xs text-gray-500">{target.description}</p>
              </div>
            </div>
            <Button
              variant={target.available ? "outline" : "ghost"}
              disabled={!target.available}
              className={target.available ? "border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0" : "text-gray-400 shrink-0"}
              onClick={() => handleDownload(target)}
            >
              {target.available ? "Download" : "Coming Soon"}
            </Button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* System Requirements                                                  */
/* ------------------------------------------------------------------ */

const SYSTEM_REQUIREMENTS = [
  { os: "Windows", icon: Monitor, items: ["Windows 10 or later", "8 GB RAM recommended", "Intel i5 / Ryzen 5+"] },
  { os: "macOS", icon: Apple, items: ["macOS Ventura or later", "Apple Silicon or Intel", "8 GB RAM"] },
  { os: "Linux", icon: Terminal, items: ["Ubuntu 22.04+", "8 GB RAM"] },
];

function SystemRequirementsCard() {
  return (
    <SettingsCard className="shadow-sm">
      <h3 className="font-display text-base font-bold text-gray-900 mb-4">System Requirements</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SYSTEM_REQUIREMENTS.map((req) => (
          <div key={req.os} className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <req.icon className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-900">{req.os}</p>
            </div>
            <ul className="space-y-1.5">
              {req.items.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-gray-500">
                  <Check className="h-3 w-3 text-gray-300 mt-0.5 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Connected Devices                                                    */
/* ------------------------------------------------------------------ */

function ConnectedDevicesCard() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DesktopDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    fetchDesktopDevices(user.id).then(setDevices).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleRemove = async (deviceId: string) => {
    if (!user) return;
    setRemovingId(deviceId);
    try {
      await disconnectDesktopDevice(deviceId, user.id);
      toast({ title: "Device removed" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't remove device", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <SettingsCard className="shadow-sm">
      <h3 className="font-display text-base font-bold text-gray-900 mb-1">Connected Devices</h3>
      <p className="text-sm text-gray-500 mb-4">Desktop app installs signed into your account.</p>

      {loading && <p className="text-sm text-gray-400 text-center py-6">Loading devices...</p>}

      {!loading && devices.length === 0 && (
        <div className="text-center py-8">
          <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-3">
            <Laptop className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No desktop devices connected yet.</p>
        </div>
      )}

      {!loading && devices.length > 0 && (
        <div className="space-y-1">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{device.deviceName}</p>
                <p className="text-xs text-gray-500">
                  {device.os}{device.appVersion ? ` · v${device.appVersion}` : ""} · Last active {formatDate(device.lastActive)}
                </p>
              </div>
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
                disabled={removingId === device.id}
                onClick={() => handleRemove(device.id)}
              >
                {removingId === device.id ? "Removing..." : "Disconnect"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile Apps (Coming Soon)                                            */
/* ------------------------------------------------------------------ */

function MobileAppsCard() {
  const [notified, setNotified] = useState(false);

  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full mb-3">
            <Smartphone className="h-3 w-3" /> Coming soon
          </span>
          <h3 className="font-display text-base font-bold text-gray-900 mb-1.5">Mobile Apps</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            Take WebdevsAI with you — build, preview, and chat with the AI from Android and iOS. Scan the QR code once it's live, or ask us to email you.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={notified}
              onClick={() => {
                setNotified(true);
                toast({ title: "You're on the list", description: "We'll email you the moment the mobile apps are ready." });
              }}
            >
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              {notified ? "We'll notify you" : "Notify me when available"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <QrCode className="h-8 w-8 text-gray-300" />
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>Android</p>
            <p>iOS</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function DevicesSection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Record<MessagingProvider, MessagingConnection> | null>(null);

  const refreshMessaging = () => {
    if (!user) return;
    fetchMessagingConnections(user.id).then(setConnections).catch(() => {});
  };

  useEffect(() => {
    refreshMessaging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Light polling while the Telegram dialog is open needs live status — cheapest
  // way without a websocket is to just re-fetch every few seconds while mounted.
  useEffect(() => {
    const id = window.setInterval(refreshMessaging, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 -mt-4">
        Connect your messaging apps and install the WebdevsAI desktop application to work from anywhere.
      </p>

      <MessagingAppsCard connections={connections} onRefresh={refreshMessaging} />
      <ConnectedAccountsCard />
      <DesktopShowcaseCard />
      <DownloadsCard />
      <SystemRequirementsCard />
      <ConnectedDevicesCard />
      <MobileAppsCard />
    </div>
  );
}
