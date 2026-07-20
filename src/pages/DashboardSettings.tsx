// path: src/pages/DashboardSettings.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserWorkspaces } from "@/services/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import type { Workspace } from "@/lib/workspaces";
import {
  ArrowLeft, User, Laptop, Users, UsersRound, Fingerprint, BookOpen, Wand2,
  LayoutTemplate, Palette, Plug, GitBranch, Server, Globe, ShieldCheck,
  ShieldAlert, ScrollText, Sparkles,
} from "lucide-react";
import AccountSection from "@/components/settings/AccountSection";
import WorkspaceSection from "@/components/settings/WorkspaceSection";
import PlansSection from "@/components/settings/PlansSection";
import PeopleSection from "@/components/settings/PeopleSection";
import GitSection from "@/components/settings/GitSection";
import ComingSoonSection from "@/components/settings/ComingSoonSection";

type SectionId =
  | "account" | "devices"
  | "workspace" | "plans"
  | "people" | "groups" | "identity"
  | "knowledge" | "skills" | "templates" | "design-systems" | "connectors"
  | "git" | "mcp" | "domains"
  | "privacy" | "security-center" | "audit-logs";

const DashboardSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const section = (searchParams.get("section") as SectionId) || "workspace";

  useEffect(() => {
    fetchUserWorkspaces()
      .then((list) => {
        setWorkspaces(list);
        const stored = localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY);
        setCurrentWorkspaceId((stored && list.some((w) => w.id === stored) ? stored : list[0]?.id) ?? null);
      })
      .catch(() => {});
  }, []);

  // "Connectors" isn't its own page here — it lives on the real Resources page.
  useEffect(() => {
    if (section === "connectors") navigate("/dashboard/resources?connectors", { replace: true });
  }, [section, navigate]);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  );

  const goTo = (id: SectionId) => setSearchParams({ section: id });

  const nav: { group?: string; items: { id: SectionId; label: string; icon: typeof User }[] }[] = [
    { items: [
      { id: "account", label: user?.name || "Account", icon: User },
      { id: "devices", label: "Devices & apps", icon: Laptop },
    ] },
    { group: "Workspace", items: [
      { id: "workspace", label: currentWorkspace?.name || "Workspace", icon: Sparkles },
      { id: "plans", label: "Plans & credit usage", icon: Wand2 },
    ] },
    { group: "Access", items: [
      { id: "people", label: "People", icon: Users },
      { id: "groups", label: "Groups", icon: UsersRound },
      { id: "identity", label: "Identity", icon: Fingerprint },
    ] },
    { group: "Customization", items: [
      { id: "knowledge", label: "Knowledge", icon: BookOpen },
      { id: "skills", label: "Skills", icon: Wand2 },
      { id: "templates", label: "Templates", icon: LayoutTemplate },
      { id: "design-systems", label: "Design systems", icon: Palette },
      { id: "connectors", label: "Connectors", icon: Plug },
    ] },
    { group: "Build & deploy", items: [
      { id: "git", label: "Git", icon: GitBranch },
      { id: "mcp", label: "MCP server", icon: Server },
      { id: "domains", label: "Workspace domains", icon: Globe },
    ] },
    { group: "Security", items: [
      { id: "privacy", label: "Privacy & security", icon: ShieldCheck },
      { id: "security-center", label: "Security center", icon: ShieldAlert },
      { id: "audit-logs", label: "Audit logs", icon: ScrollText },
    ] },
  ];

  const renderSection = () => {
    if (section === "account") return <AccountSection />;
    if (section === "devices") return <ComingSoonSection icon={Laptop} title="Devices & apps" description="Manage where you're signed in and connected apps." />;
    if (section === "workspace") {
      if (!currentWorkspace) return null;
      return <WorkspaceSection workspace={currentWorkspace} workspaceCount={workspaces.length} currentUserId={user?.id} onWorkspaceUpdated={(w) => setWorkspaces((prev) => prev.map((x) => (x.id === w.id ? w : x)))} />;
    }
    if (section === "plans") return <PlansSection />;
    if (section === "people") {
      if (!currentWorkspace) return null;
      return <PeopleSection workspace={currentWorkspace} currentUserId={user?.id} />;
    }
    if (section === "groups") return <ComingSoonSection icon={UsersRound} title="Groups" description="Organize members into groups with shared permissions." />;
    if (section === "identity") return <ComingSoonSection icon={Fingerprint} title="Identity" description="Single sign-on and identity provider settings." />;
    if (section === "knowledge") return <ComingSoonSection icon={BookOpen} title="Knowledge" description="Give the AI extra context about your product and codebase." />;
    if (section === "skills") return <ComingSoonSection icon={Wand2} title="Skills" description="Reusable AI instructions your workspace can invoke." />;
    if (section === "templates") return <ComingSoonSection icon={LayoutTemplate} title="Templates" description="Save your own starting points for new projects." />;
    if (section === "design-systems") return <ComingSoonSection icon={Palette} title="Design systems" description="Reusable design tokens and component libraries." />;
    if (section === "git") return <GitSection />;
    if (section === "mcp") return <ComingSoonSection icon={Server} title="MCP server" description="Connect external tools to WebdevsAI via the Model Context Protocol." />;
    if (section === "domains") return <ComingSoonSection icon={Globe} title="Workspace domains" description="Manage custom domains at the workspace level. For now, domains are configured per project from the Deploy menu." />;
    if (section === "privacy") return <ComingSoonSection icon={ShieldCheck} title="Privacy & security" description="Two-factor authentication and session controls." />;
    if (section === "security-center") return <ComingSoonSection icon={ShieldAlert} title="Security center" description="Review security recommendations for your workspace." />;
    if (section === "audit-logs") return <ComingSoonSection icon={ScrollText} title="Audit logs" description="A history of security-relevant actions in your workspace." />;
    return null;
  };

  const activeLabel = nav.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? "Settings";

  return (
    <div className="min-h-screen bg-gray-50/60 flex">
      {/* Settings nav sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
        <div className="p-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Go back
          </Link>
        </div>
        <nav className="px-2 pb-6 space-y-5">
          {nav.map((g, gi) => (
            <div key={gi}>
              {g.group && (
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{g.group}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => (item.id === "connectors" ? navigate("/dashboard/resources?connectors") : goTo(item.id))}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
                      section === item.id ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <Link to="/dashboard" className="md:hidden inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> Go back
          </Link>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-6">{activeLabel}</h1>
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

export default DashboardSettings;
