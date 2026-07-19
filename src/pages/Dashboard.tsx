// path: src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu } from "lucide-react";
import { Project, generateSlug } from "@/lib/projects";
import { generateApp } from "@/services/ai";
import { fetchUserProjects, insertProject, deleteProject as dbDeleteProject, fetchProfileCredits } from "@/services/db";
import { createBaselineVersion } from "@/services/versions";
import Sidebar, { ProjectFilter } from "@/components/dashboard/Sidebar";
import { useWorkbenchTheme } from "@/hooks/use-workbench-theme";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProjectsSection from "@/components/dashboard/ProjectsSection";
import ProjectModal from "@/components/dashboard/ProjectModal";
import { ConnectGitHubButton } from "@/components/dashboard/GitHubButton";
import { getGitHubStatus, exchangeGitHubCode } from "@/services/github";
import { toast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [ghConnected, setGhConnected] = useState(false);
  const [ghUsername, setGhUsername] = useState<string>();
  const [isMultipage, setIsMultipage] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState<ProjectFilter>("all");
  const { theme, toggleTheme } = useWorkbenchTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [creditsRemaining, setCreditsRemaining] = useState<number>();
  const [creditsLimit, setCreditsLimit] = useState<number>();

  // "Created by me" is equivalent to "All projects" today since this app has
  // no team/multi-owner model yet. "Shared with me" has no data source yet
  // (no collaboration feature) so it correctly shows an empty state.
  const visibleProjects = useMemo(() => {
    let list = projects;
    if (sidebarFilter === "starred") {
      list = list.filter((p) => p.is_starred);
    } else if (sidebarFilter === "shared") {
      list = [];
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [projects, sidebarFilter, searchQuery]);

  const refreshGitHub = () => {
    getGitHubStatus().then(({ connected, username }) => {
      setGhConnected(connected);
      setGhUsername(username);
    });
  };

  useEffect(() => {
    if (!user?.id) return;
    setLoadingProjects(true);
    fetchUserProjects(user.id)
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => setLoadingProjects(false));

    fetchProfileCredits(user.id)
      .then((c) => { setCreditsRemaining(c.credits_remaining); setCreditsLimit(c.credits_daily_limit); })
      .catch((err) => console.error("Failed to load credits:", err));

    refreshGitHub();

    const templateParams = new URLSearchParams(window.location.search);
    const templatePrompt = templateParams.get("template_prompt");
    if (templatePrompt) {
      setPrompt(templatePrompt);
      setIsMultipage(templateParams.get("template_multipage") === "true");
      window.history.replaceState({}, "", "/dashboard");
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && params.get("github_callback") !== null) {
      window.history.replaceState({}, "", "/dashboard");
      exchangeGitHubCode(code)
        .then(({ github_username }) => {
          setGhConnected(true);
          setGhUsername(github_username);
          toast({ title: "GitHub connected! 🎉", description: `Signed in as ${github_username}` });
        })
        .catch((err) => toast({ title: "GitHub auth failed", description: err.message, variant: "destructive" }));
    }
  }, [user?.id]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating || !user) return;
    setGenerating(true);
    try {
      const result = await generateApp(prompt, isMultipage);
      const slug = generateSlug(result.title || prompt.slice(0, 40));
      const newProject = await insertProject({
        user_id: user.id,
        title: result.title || prompt.slice(0, 60),
        type: result.type,
        prompt,
        slug,
        html: result.html,
        css: result.css,
        react_code: result.react_code,
        is_multipage: result.is_multipage ?? isMultipage,
        pages: result.pages ?? null,
      });
      setProjects((prev) => [newProject, ...prev]);
      setPrompt("");
      if (typeof result.credits_remaining === "number") {
        setCreditsRemaining(result.credits_remaining);
      }
      createBaselineVersion(newProject.id, {
        html: newProject.html || "",
        css: newProject.css || "",
        react_code: newProject.react_code || "",
        pages: newProject.pages,
      }).catch((err) => console.error("Failed to create baseline version:", err));
      toast({ title: "App generated!", description: `"${newProject.title}" is ready.` });
    } catch (err) {
      console.error("Generation failed:", err);
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbDeleteProject(deleteTarget);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget));
      toast({ title: "Project deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleProjectUpdate = (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProject((sel) => (sel?.id === updated.id ? updated : sel));
  };

  return (
    <div className="min-h-screen flex wb-sans" data-wb-theme={theme} style={{ background: "var(--wb-canvas)" }}>
      <Sidebar
        projects={projects}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeFilter={sidebarFilter}
        onFilterChange={setSidebarFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        creditsRemaining={creditsRemaining}
        creditsLimit={creditsLimit}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header
          className="lg:hidden h-12 border-b flex items-center justify-between px-4"
          style={{ background: "var(--wb-canvas)", borderColor: "var(--wb-line)" }}
        >
          <button onClick={() => setSidebarOpen(true)} style={{ color: "var(--wb-text-muted)" }}>
            <Menu className="h-5 w-5" />
          </button>
          <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHub} />
        </header>

        <div
          className="hidden lg:flex items-center justify-end px-6 py-2 border-b"
          style={{ background: "var(--wb-canvas)", borderColor: "var(--wb-line)" }}
        >
          <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHub} />
        </div>

        <main className="flex-1 overflow-auto" style={{ background: "var(--wb-canvas)" }}>
          <DashboardHeader
            userName={user?.name?.split(" ")[0] || "there"}
            prompt={prompt}
            generating={generating}
            isMultipage={isMultipage}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onToggleMultipage={setIsMultipage}
          />

          {sidebarFilter === "shared" && !loadingProjects && (
            <p className="px-6 md:px-8 -mt-2 mb-2 text-[13px]" style={{ color: "var(--wb-text-muted)" }}>
              Team sharing isn't set up yet — projects others share with you will show up here.
            </p>
          )}
          <ProjectsSection
            projects={visibleProjects}
            loading={loadingProjects}
            onOpen={setSelectedProject}
            onDelete={(id) => setDeleteTarget(id)}
            onStarChange={(updated) =>
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
          />

          <div className="h-8" />
        </main>
      </div>

      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdate={handleProjectUpdate}
        ghConnected={ghConnected}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[var(--wb-surface)] border-[var(--wb-line)] wb-sans">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--wb-text)]">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--wb-text-muted)]">
              This action cannot be undone. This will permanently delete your project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[var(--wb-surface-raised)] text-[var(--wb-text)] border-[var(--wb-line)] hover:bg-[var(--wb-surface-raised)] hover:brightness-125">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
