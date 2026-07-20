// path: src/components/dashboard/Sidebar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Project } from "@/lib/projects";
import type { Workspace } from "@/lib/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import { fetchUserWorkspaces } from "@/services/workspaces";
import {
  Home, Search, BookOpen, LayoutGrid, Star, UserCircle, Users, Plug,
  FileText, ChevronDown, Sparkles, Zap, X, LogOut, Settings, UserPlus,
  Check, Plus, Sun, Moon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import SettingsModal from "./SettingsModal";
import UpgradeDialog from "./UpgradeDialog";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import WorkspaceMembersDialog from "./WorkspaceMembersDialog";
import type { WorkbenchTheme } from "@/hooks/use-workbench-theme";

export type ProjectFilter = "all" | "starred" | "mine" | "shared";

interface SidebarProps {
  projects: Project[];
  open: boolean;
  onClose: () => void;
  activeFilter: ProjectFilter;
  onFilterChange: (filter: ProjectFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  creditsRemaining?: number;
  creditsLimit?: number;
  theme: WorkbenchTheme;
  onToggleTheme: () => void;
  /** Fires once workspaces load, and again whenever the active workspace changes (switch or create). */
  onWorkspaceChange?: (workspaceId: string) => void;
}

const projectItems: { icon: typeof LayoutGrid; label: string; id: ProjectFilter }[] = [
  { icon: LayoutGrid, label: "All projects", id: "all" },
  { icon: Star, label: "Starred", id: "starred" },
  { icon: UserCircle, label: "Created by me", id: "mine" },
  { icon: Users, label: "Shared with me", id: "shared" },
];

export default function Sidebar({
  projects, open, onClose, activeFilter, onFilterChange, searchQuery, onSearchChange,
  creditsRemaining, creditsLimit, theme, onToggleTheme, onWorkspaceChange,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [wsOpen, setWsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const recentProjects = projects.slice(0, 3);
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null;

  useEffect(() => {
    fetchUserWorkspaces()
      .then((list) => {
        setWorkspaces(list);
        const stored = localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY);
        const resolved = (stored && list.some((w) => w.id === stored) ? stored : list[0]?.id) ?? null;
        setCurrentWorkspaceId(resolved);
        if (resolved) {
          localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, resolved);
          onWorkspaceChange?.(resolved);
        }
      })
      .catch((err) => toast({ title: "Couldn't load workspaces", description: err.message, variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchWorkspace = (id: string) => {
    setCurrentWorkspaceId(id);
    localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, id);
    onWorkspaceChange?.(id);
    setWsOpen(false);
  };

  const handleWorkspaceCreated = (w: Workspace) => {
    setWorkspaces((prev) => [...prev, w]);
    switchWorkspace(w.id);
  };

  const shareReferralLink = async () => {
    const link = `${window.location.origin}/signup?ref=${user?.id ?? ""}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied", description: "You'll get 5 bonus credits when they sign up." });
    } catch {
      toast({ title: "Couldn't copy link", description: link, variant: "destructive" });
    }
    setWsOpen(false);
  };

  const goHome = () => {
    onFilterChange("all");
    onSearchChange("");
    setSearchOpen(false);
    navigate("/dashboard");
  };

  const menuItems = [
    { icon: Home, label: "Home", id: "home", shortcut: "", onClick: goHome, active: activeFilter === "all" && !searchQuery },
    {
      icon: Search, label: "Search", id: "search", shortcut: "Ctrl K",
      onClick: () => setSearchOpen((v) => !v), active: searchOpen,
    },
    {
      icon: BookOpen, label: "Resources", id: "resources", shortcut: "",
      onClick: () => navigate("/dashboard/resources"),
      active: false,
    },
    {
      icon: Plug, label: "Connectors", id: "connectors", shortcut: "",
      onClick: () => navigate("/dashboard/resources?connectors"),
      active: false,
    },
  ];

  const wbSurface = { background: "var(--wb-surface)" };
  const wbLine = { borderColor: "var(--wb-line)" };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] flex-shrink-0
          border-r flex flex-col wb-sans
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: "var(--wb-canvas)", borderColor: "var(--wb-line)" }}
      >
        {/* Top: Workspace Dropdown */}
        <div className="p-3 border-b relative flex items-center gap-1.5" style={wbLine}>
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:brightness-125 min-w-0"
                style={wbSurface}
              >
                <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: "var(--wb-ember)" }}>
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="wb-display text-sm font-semibold truncate flex-1 text-left" style={{ color: "var(--wb-text)" }}>
                  {currentWorkspace?.name ?? "Loading..."}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${wsOpen ? "rotate-180" : ""}`}
                  style={{ color: "var(--wb-text-muted)" }}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start" sideOffset={6}
              className="w-[280px] p-0 rounded-lg shadow-lg border"
              style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
            >
              {/* Workspace Info */}
              <div className="px-3 pt-3 pb-2 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--wb-ember)" }}>
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--wb-text)" }}>{currentWorkspace?.name ?? "Workspace"}</p>
                  <p className="wb-mono text-[11px]" style={{ color: "var(--wb-text-muted)" }}>Free Plan</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-3 pb-2 flex gap-2">
                <button
                  onClick={() => { setWsOpen(false); setSettingsOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors hover:brightness-125"
                  style={{ ...wbLine, color: "var(--wb-text)" }}
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </button>
                <button
                  onClick={() => { setWsOpen(false); setMembersOpen(true); }}
                  disabled={!currentWorkspace}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors hover:brightness-125 disabled:opacity-50"
                  style={{ ...wbLine, color: "var(--wb-text)" }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              </div>

              {/* Upgrade */}
              <div className="mx-3 mb-2 flex items-center justify-between px-3 py-2 rounded-md" style={{ background: "var(--wb-surface-raised)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--wb-text)" }}>Turn Pro</span>
                <button
                  onClick={() => { setWsOpen(false); setUpgradeOpen(true); }}
                  className="px-3 py-1 rounded-md text-white text-xs font-medium transition-opacity hover:opacity-90"
                  style={{ background: "var(--wb-ember)" }}
                >
                  Upgrade
                </button>
              </div>

              {/* Credits */}
              <div className="px-3 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="wb-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--wb-text-muted)" }}>Credits</span>
                  <span className="wb-mono text-xs font-medium" style={{ color: "var(--wb-circuit)" }}>
                    {creditsRemaining ?? "-"} / {creditsLimit ?? "-"} left
                  </span>
                </div>
                <Progress
                  value={creditsLimit ? Math.max(0, Math.min(100, (creditsRemaining ?? 0) / creditsLimit * 100)) : 0}
                  className="h-1.5 bg-[var(--wb-surface-raised)] [&>div]:bg-[var(--wb-ember)]"
                />
                <p className="wb-mono text-[10px] mt-1" style={{ color: "var(--wb-text-muted)" }}>Daily credits reset at midnight UTC</p>
              </div>

              {/* Divider */}
              <div className="border-t" style={wbLine} />

              {/* All Workspaces */}
              <div className="px-3 pt-2 pb-1">
                <p className="wb-mono text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--wb-text-muted)" }}>All workspaces</p>
                <div className="space-y-0.5 max-h-40 overflow-auto">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => switchWorkspace(w.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors hover:brightness-125"
                      style={{ background: w.id === currentWorkspaceId ? "var(--wb-surface-raised)" : "transparent" }}
                    >
                      <div className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--wb-ember)" }}>
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium flex-1 truncate text-left" style={{ color: "var(--wb-text)" }}>{w.name}</span>
                      <span className="wb-mono text-[10px] font-medium border rounded px-1.5 py-0.5" style={{ ...wbLine, color: "var(--wb-text-muted)" }}>
                        {w.plan.toUpperCase()}
                      </span>
                      {w.id === currentWorkspaceId && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--wb-circuit)" }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create new */}
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={() => { setWsOpen(false); setCreateWorkspaceOpen(true); }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors border border-dashed hover:brightness-125"
                  style={{ ...wbLine, color: "var(--wb-text-muted)" }}
                >
                  <Plus className="h-3.5 w-3.5" /> Create new workspace
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <button onClick={onClose} className="absolute top-3 right-3 lg:hidden" style={{ color: "var(--wb-text-muted)" }}>
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={onToggleTheme}
            className="hidden lg:flex flex-shrink-0 p-1.5 rounded-md transition-colors hover:brightness-125"
            style={{ background: "var(--wb-surface-raised)", color: "var(--wb-text-muted)" }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className="w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-1.5 text-[13px] font-medium transition-colors border-l-2 rounded-r-md"
                style={{
                  borderLeftColor: item.active ? "var(--wb-ember)" : "transparent",
                  background: item.active ? "var(--wb-surface)" : "transparent",
                  color: item.active ? "var(--wb-text)" : "var(--wb-text-muted)",
                }}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="wb-mono text-[10px] font-normal" style={{ color: "var(--wb-text-muted)" }}>{item.shortcut}</span>
                )}
              </button>
            ))}
            {searchOpen && (
              <div className="px-1 pt-1">
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search projects..."
                  className="h-8 text-[13px] wb-sans"
                  style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)", color: "var(--wb-text)" }}
                />
              </div>
            )}
          </div>

          {/* Projects */}
          <div>
            <span className="px-2.5 wb-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--wb-text-muted)" }}>Projects</span>
            <div className="mt-1 space-y-0.5">
              {projectItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onFilterChange(item.id)}
                  className="w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-1.5 text-[13px] font-medium transition-colors border-l-2 rounded-r-md"
                  style={{
                    borderLeftColor: activeFilter === item.id ? "var(--wb-circuit)" : "transparent",
                    background: activeFilter === item.id ? "var(--wb-surface)" : "transparent",
                    color: activeFilter === item.id ? "var(--wb-text)" : "var(--wb-text-muted)",
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recents */}
          {recentProjects.length > 0 && (
            <div>
              <span className="px-2.5 wb-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--wb-text-muted)" }}>Recents</span>
              <div className="mt-1 space-y-0.5">
                {recentProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/editor/${p.id}`)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors hover:brightness-125"
                    style={{ color: "var(--wb-text-muted)" }}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" style={{ color: "var(--wb-text-muted)" }} />
                    <span className="flex-1 text-left truncate">{p.title}</span>
                    {p.is_starred && <Star className="h-3 w-3 flex-shrink-0" style={{ color: "var(--wb-ember)", fill: "var(--wb-ember)" }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom Cards */}
        <div className="p-2 space-y-1.5 border-t" style={wbLine}>
          <div
            onClick={shareReferralLink}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer hover:brightness-125"
            style={wbSurface}
          >
            <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: "var(--wb-surface-raised)" }}>
              <Users className="h-3.5 w-3.5" style={{ color: "var(--wb-circuit)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--wb-text)" }}>Share WebdevsAI</p>
              <p className="wb-mono text-[10px]" style={{ color: "var(--wb-text-muted)" }}>5 credits per referral</p>
            </div>
          </div>

          <div
            onClick={() => setUpgradeOpen(true)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer hover:brightness-125"
            style={wbSurface}
          >
            <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: "var(--wb-surface-raised)" }}>
              <Zap className="h-3.5 w-3.5" style={{ color: "var(--wb-ember)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--wb-text)" }}>Upgrade to Pro</p>
              <p className="wb-mono text-[10px]" style={{ color: "var(--wb-text-muted)" }}>Unlock more benefits</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--wb-ember)" }}>
                <span className="text-xs text-white font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-[13px] truncate max-w-[120px]" style={{ color: "var(--wb-text-muted)" }}>{user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded transition-colors hover:text-red-400"
              style={{ color: "var(--wb-text-muted)" }}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
      <WorkspaceMembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        workspace={currentWorkspace}
        currentUserId={user?.id}
      />
    </>
  );
}
