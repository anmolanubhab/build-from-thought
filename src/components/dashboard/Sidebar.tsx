// path: src/components/dashboard/Sidebar.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Project } from "@/lib/projects";
import {
  Home, Search, BookOpen, LayoutGrid, Star, UserCircle, Users,
  FileText, ChevronDown, Sparkles, Zap, X, LogOut, Settings, UserPlus,
  Check, Plus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import SettingsModal from "./SettingsModal";

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
}

const projectItems: { icon: typeof LayoutGrid; label: string; id: ProjectFilter }[] = [
  { icon: LayoutGrid, label: "All projects", id: "all" },
  { icon: Star, label: "Starred", id: "starred" },
  { icon: UserCircle, label: "Created by me", id: "mine" },
  { icon: Users, label: "Shared with me", id: "shared" },
];

export default function Sidebar({
  projects, open, onClose, activeFilter, onFilterChange, searchQuery, onSearchChange,
  creditsRemaining, creditsLimit,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [wsOpen, setWsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recentProjects = projects.slice(0, 3);

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/signup?ref=${user?.id ?? ""}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied", description: "You'll get 5 bonus credits when they sign up." });
    } catch {
      toast({ title: "Couldn't copy link", description: link, variant: "destructive" });
    }
    setWsOpen(false);
  };

  const createWorkspace = () => {
    toast({ title: "Multiple workspaces", description: "This feature is coming soon." });
    setWsOpen(false);
  };

  const goHome = () => {
    onFilterChange("all");
    onSearchChange("");
    setSearchOpen(false);
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
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] flex-shrink-0
          bg-white border-r border-gray-200 flex flex-col
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Top: Workspace Dropdown */}
        <div className="p-3 border-b border-gray-100">
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-900 truncate flex-1 text-left">
                  WebdevsAI Workspace
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${wsOpen ? "rotate-180" : ""}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-[280px] p-0 rounded-lg shadow-lg border border-gray-200 bg-white">
              {/* Workspace Info */}
              <div className="px-3 pt-3 pb-2 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">WebdevsAI Workspace</p>
                  <p className="text-xs text-gray-500">Free Plan • 2 members</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-3 pb-2 flex gap-2">
                <button
                  onClick={() => { setWsOpen(false); setSettingsOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </button>
                <button
                  onClick={copyInviteLink}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              </div>

              {/* Upgrade */}
              <div className="mx-3 mb-2 flex items-center justify-between px-3 py-2 rounded-md bg-gray-50">
                <span className="text-xs font-semibold text-gray-800">Turn Pro</span>
                <button className="px-3 py-1 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors">
                  Upgrade
                </button>
              </div>

              {/* Credits */}
              <div className="px-3 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Credits</span>
                  <span className="text-xs font-semibold text-gray-800">
                    {creditsRemaining ?? "-"} / {creditsLimit ?? "-"} left
                  </span>
                </div>
                <Progress
                  value={creditsLimit ? Math.max(0, Math.min(100, (creditsRemaining ?? 0) / creditsLimit * 100)) : 0}
                  className="h-1.5 bg-gray-200 [&>div]:bg-violet-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Daily credits reset at midnight UTC</p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* All Workspaces */}
              <div className="px-3 pt-2 pb-1">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">All workspaces</p>
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-gray-50">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-900 flex-1 truncate">WebdevsAI Workspace</span>
                  <span className="text-[10px] font-medium text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">FREE</span>
                  <Check className="h-3.5 w-3.5 text-violet-600" />
                </div>
              </div>

              {/* Create new */}
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={createWorkspace}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors border border-dashed border-gray-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Create new workspace
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <button onClick={onClose} className="absolute top-3 right-3 lg:hidden text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  item.active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[11px] text-gray-400 font-normal">{item.shortcut}</span>
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
                  className="h-8 text-[13px]"
                />
              </div>
            )}
          </div>

          {/* Projects */}
          <div>
            <span className="px-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
            <div className="mt-1 space-y-0.5">
              {projectItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onFilterChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeFilter === item.id
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
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
              <span className="px-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Recents</span>
              <div className="mt-1 space-y-0.5">
                {recentProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/editor/${p.id}`)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 text-left truncate">{p.title}</span>
                    {p.is_starred && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom Cards */}
        <div className="p-2 space-y-1.5 border-t border-gray-100">
          <div
            onClick={copyInviteLink}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <div className="h-7 w-7 rounded-md bg-gray-200 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900">Share WebdevsAI</p>
              <p className="text-[11px] text-gray-400">5 credits per referral</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
            <div className="h-7 w-7 rounded-md bg-amber-100 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900">Upgrade to Pro</p>
              <p className="text-[11px] text-gray-400">Unlock more benefits</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <span className="text-xs text-white font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-[13px] text-gray-600 truncate max-w-[120px]">{user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
