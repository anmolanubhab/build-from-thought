// path: src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu } from "lucide-react";
import { Project, generateSlug } from "@/lib/projects";
import { generateApp, planProject, type ProjectPlan } from "@/services/ai";
import { fetchWorkspaceProjects, insertProject, deleteProject as dbDeleteProject, fetchProfileCredits } from "@/services/db";
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<"preview" | "code">("preview");
  const [modalInitialDevice, setModalInitialDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
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
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  // With workspaces, every project in the list is already implicitly "shared"
  // with the whole workspace — "Created by me" / "Shared with me" now split
  // on who actually created each project rather than being no-ops.
  const visibleProjects = useMemo(() => {
    let list = projects;
    if (sidebarFilter === "starred") {
      list = list.filter((p) => p.is_starred);
    } else if (sidebarFilter === "mine") {
      list = list.filter((p) => p.user_id === user?.id);
    } else if (sidebarFilter === "shared") {
      list = list.filter((p) => p.user_id !== user?.id);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [projects, sidebarFilter, searchQuery, user?.id]);

  const refreshGitHub = () => {
    getGitHubStatus().then(({ connected, username }) => {
      setGhConnected(connected);
      setGhUsername(username);
    });
  };

  useEffect(() => {
    if (!currentWorkspaceId) return;
    setLoadingProjects(true);
    fetchWorkspaceProjects(currentWorkspaceId)
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => setLoadingProjects(false));
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!user?.id) return;
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
    if (!prompt.trim() || generating || !user || !currentWorkspaceId) return;
    setGenerating(true);
    let stageTimer: ReturnType<typeof setInterval> | undefined;
    try {
      // --- Stage 1: Planner Agent ---
      setGenStage("Understanding your request...");
      let plan: ProjectPlan | null = null;
      try {
        plan = await planProject(prompt, isMultipage);
      } catch (planErr) {
        // Planning is an enhancement, never a blocker — generation works without it.
        console.error("Planner failed, generating without a plan:", planErr);
      }
      setGenStage("Planning project architecture...");

      // --- Stage 2: Builder + QA pipeline (rotate real pipeline stage labels) ---
      const buildStages = [
        "Designing UI...",
        "Generating components...",
        ...(plan?.needs_database ? ["Creating database schema..."] : []),
        ...(plan?.needs_auth || plan?.needs_api ? ["Connecting backend..."] : []),
        "Validating project...",
      ];
      let stageIdx = 0;
      setGenStage(buildStages[0]);
      stageTimer = setInterval(() => {
        stageIdx = Math.min(stageIdx + 1, buildStages.length - 1);
        setGenStage(buildStages[stageIdx]);
      }, 6000);

      const result = await generateApp(prompt, isMultipage, plan);
      clearInterval(stageTimer);
      stageTimer = undefined;
      setGenStage("Preparing your project...");
      const slug = generateSlug(result.title || prompt.slice(0, 40));
      const newProject = await insertProject({
        user_id: user.id,
        workspace_id: currentWorkspaceId,
        title: result.title || prompt.slice(0, 60),
        type: result.type,
        prompt,
        slug,
        html: result.html,
        css: result.css,
        react_code: result.react_code,
        is_multipage: result.is_multipage ?? isMultipage,
        pages: result.pages ?? null,
        files: result.files ?? null,
        stack: result.stack ?? "static",
        plan: (result.plan ?? null) as Record<string, unknown> | null,
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
        files: newProject.files ?? null,
      }).catch((err) => console.error("Failed to create baseline version:", err));
      toast({ title: "Project ready!", description: `"${newProject.title}" is ready.` });
    } catch (err) {
      console.error("Generation failed:", err);
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      if (stageTimer) clearInterval(stageTimer);
      setGenStage(null);
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

  // ProjectActionMenu's "Preview Mobile" / "Export" open the same preview
  // modal, just seeded to a different tab/device — everything else keeps
  // going through the plain onOpen(project) card-click path (preview, desktop).
  const handleOpenProject = (
    project: Project,
    opts?: { tab?: "preview" | "code"; device?: "desktop" | "tablet" | "mobile" },
  ) => {
    setModalInitialTab(opts?.tab ?? "preview");
    setModalInitialDevice(opts?.device ?? "desktop");
    setSelectedProject(project);
  };

  const handleProjectCreated = (created: Project) => {
    setProjects((prev) => [created, ...prev]);
    navigate(`/editor/${created.id}`);
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
        onWorkspaceChange={setCurrentWorkspaceId}
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
            stage={genStage}
            isMultipage={isMultipage}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onToggleMultipage={setIsMultipage}
          />

          <ProjectsSection
            projects={visibleProjects}
            loading={loadingProjects}
            onOpen={handleOpenProject}
            onDelete={(id) => setDeleteTarget(id)}
            onProjectUpdate={(updated) =>
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
            onProjectCreated={handleProjectCreated}
          />

          <div className="h-8" />
        </main>
      </div>

      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdate={handleProjectUpdate}
        ghConnected={ghConnected}
        initialTab={modalInitialTab}
        initialDevice={modalInitialDevice}
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
