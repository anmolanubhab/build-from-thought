// path: src/pages/Resources.tsx
import { useNavigate } from "react-router-dom";
import {
  Menu, User, LayoutDashboard, Rocket, Building2, Newspaper, ArrowRight,
  Github, Database, Sparkles, CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import type { ProjectFilter } from "@/components/dashboard/Sidebar";
import { Badge } from "@/components/ui/badge";
import { getGitHubStatus } from "@/services/github";
import { ConnectGitHubButton } from "@/components/dashboard/GitHubButton";
import { useWorkbenchTheme } from "@/hooks/use-workbench-theme";
import { getSupabaseConnectionStatus, disconnectSupabase, type SupabaseConnectionStatus } from "@/services/userSupabase";
import ConnectSupabaseDialog from "@/components/dashboard/ConnectSupabaseDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Template {
  id: string;
  title: string;
  description: string;
  icon: typeof User;
  color: string;
  prompt: string;
  multipage: boolean;
}

const templates: Template[] = [
  {
    id: "portfolio",
    title: "Developer Portfolio",
    description: "Hero section, project grid, skills, and a contact form.",
    icon: User,
    color: "#ff3cac",
    prompt: "A modern portfolio website for a developer with a hero section, a projects grid, a skills section, and a contact form",
    multipage: false,
  },
  {
    id: "dashboard",
    title: "SaaS Analytics Dashboard",
    description: "Sidebar nav, KPI stat cards, and a revenue chart.",
    icon: LayoutDashboard,
    color: "#784ba0",
    prompt: "An admin analytics dashboard with sidebar navigation, KPI stat cards for users, revenue and growth, and a revenue chart",
    multipage: false,
  },
  {
    id: "landing",
    title: "Startup Landing Page",
    description: "Hero, features grid, pricing, and testimonials.",
    icon: Rocket,
    color: "#2b86c5",
    prompt: "A SaaS startup landing page with a hero section, a features grid, pricing cards, and testimonials",
    multipage: false,
  },
  {
    id: "business",
    title: "Multi-page Business Site",
    description: "Home, About, Services, and Contact — with shared nav.",
    icon: Building2,
    color: "#ff3cac",
    prompt: "A small business website with Home, About, Services, and Contact pages",
    multipage: true,
  },
  {
    id: "blog",
    title: "Personal Blog",
    description: "Home, About, Blog, and Contact — with shared nav.",
    icon: Newspaper,
    color: "#784ba0",
    prompt: "A multi-page personal blog with Home, About, Blog, and Contact pages",
    multipage: true,
  },
];

type Tab = "templates" | "connectors";

export default function Resources() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(
    new URLSearchParams(window.location.search).has("connectors") ? "connectors" : "templates"
  );
  const [ghConnected, setGhConnected] = useState(false);
  const [ghUsername, setGhUsername] = useState<string>();
  const { theme, toggleTheme } = useWorkbenchTheme();
  const [sbStatus, setSbStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [sbDialogOpen, setSbDialogOpen] = useState(false);

  const refreshSupabaseStatus = () => {
    getSupabaseConnectionStatus().then(setSbStatus).catch((err) => console.error("Failed to load Supabase connection status:", err));
  };

  const handleDisconnectSupabase = async () => {
    try {
      await disconnectSupabase();
      refreshSupabaseStatus();
      toast({ title: "Supabase disconnected" });
    } catch (err) {
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const refreshGitHub = () => {
    getGitHubStatus().then(({ connected, username }) => {
      setGhConnected(connected);
      setGhUsername(username);
    });
  };

  useEffect(() => {
    refreshGitHub();
    refreshSupabaseStatus();
  }, []);

  const switchTab = (next: Tab) => {
    setTab(next);
    const url = next === "connectors" ? "/dashboard/resources?connectors" : "/dashboard/resources";
    window.history.replaceState({}, "", url);
  };

  const useTemplate = (t: Template) => {
    const params = new URLSearchParams({
      template_prompt: t.prompt,
      template_multipage: String(t.multipage),
    });
    navigate(`/dashboard?${params.toString()}`);
  };

  const noop = () => {};

  return (
    <div className="min-h-screen bg-[var(--wb-canvas)] flex wb-sans" data-wb-theme={theme}>
      <Sidebar
        projects={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeFilter={"all" as ProjectFilter}
        onFilterChange={noop}
        searchQuery=""
        onSearchChange={noop}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="lg:hidden h-12 bg-[var(--wb-surface)] border-b border-[var(--wb-line)] flex items-center px-4">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--wb-text-muted)]">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-[var(--wb-text)] mb-1">Resources</h1>
            <p className="text-[var(--wb-text-muted)] mb-6">
              {tab === "templates"
                ? "Start from a template and let AI fill in the details."
                : "Manage the services connected to your workspace."}
            </p>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-8 border-b border-[var(--wb-line)]">
              <button
                onClick={() => switchTab("templates")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === "templates" ? "border-[var(--wb-ember)] text-[var(--wb-text)]" : "border-transparent text-[var(--wb-text-muted)] hover:text-[var(--wb-text)]"
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => switchTab("connectors")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === "connectors" ? "border-[var(--wb-ember)] text-[var(--wb-text)]" : "border-transparent text-[var(--wb-text-muted)] hover:text-[var(--wb-text)]"
                }`}
              >
                Connectors
              </button>
            </div>

            {tab === "templates" ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => useTemplate(t)}
                    className="text-left rounded-2xl overflow-hidden border border-[var(--wb-line)] bg-[var(--wb-surface)] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <div
                      className="h-28 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${t.color}22, ${t.color}08)` }}
                    >
                      <t.icon className="h-9 w-9" style={{ color: t.color }} />
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-[var(--wb-text)] mb-1">{t.title}</h3>
                      <p className="text-xs text-[var(--wb-text-muted)] mb-3">{t.description}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 group-hover:gap-1.5 transition-all">
                        Use this template <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {/* GitHub - user-managed connector */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-surface)] p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-[var(--wb-surface-raised)] flex items-center justify-center flex-shrink-0">
                      <Github className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--wb-text)]">GitHub</h3>
                        {ghConnected && (
                          <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Connected{ghUsername ? ` as ${ghUsername}` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--wb-text-muted)] mt-0.5">Push generated projects straight to a new repo.</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHub} />
                  </div>
                </div>

                {/* Your own Supabase - user-managed connector (Personal Access Token for now) */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-surface)] p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Database className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--wb-text)]">Your Supabase</h3>
                        {sbStatus?.connected && (
                          <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {sbStatus.project_name || "Connected"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--wb-text-muted)] mt-0.5">
                        Link your own Supabase project for apps you generate. Connected via Personal Access Token for now — 1-click OAuth is coming soon.
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {sbStatus?.connected ? (
                      <Button variant="outline" size="sm" onClick={handleDisconnectSupabase}>Disconnect</Button>
                    ) : (
                      <Button size="sm" onClick={() => setSbDialogOpen(true)}>Connect</Button>
                    )}
                  </div>
                </div>

                {/* Platform Supabase - always on, powers WebdevsAI itself */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-surface)] p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Database className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--wb-text)]">Supabase (Platform)</h3>
                        <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--wb-text-muted)] mt-0.5">Powers WebdevsAI itself — your login, projects, and credits. Built in — nothing to connect.</p>
                    </div>
                  </div>
                </div>

                {/* Gemini AI - platform-level, always on */}
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--wb-line)] bg-[var(--wb-surface)] p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--wb-text)]">Google Gemini</h3>
                      <p className="text-xs text-[var(--wb-text-muted)] mt-0.5">Powers AI app generation. Configured on the backend for your workspace.</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--wb-text-muted)] pt-2">More connectors (Slack, Notion, and others) are on the roadmap.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <ConnectSupabaseDialog
        open={sbDialogOpen}
        onClose={() => setSbDialogOpen(false)}
        onConnected={() => refreshSupabaseStatus()}
      />
    </div>
  );
}
