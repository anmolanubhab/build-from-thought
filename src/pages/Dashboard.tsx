import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu } from "lucide-react";
import { Project, generateSlug } from "@/lib/projects";
import { generateApp } from "@/services/ai";
import { fetchUserProjects, insertProject, deleteProject as dbDeleteProject } from "@/services/db";
import Sidebar from "@/components/dashboard/Sidebar";
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

    refreshGitHub();

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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar projects={projects} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="lg:hidden h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="h-5 w-5" />
          </button>
          <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHub} />
        </header>

        <div className="hidden lg:flex items-center justify-end px-6 py-2 border-b border-gray-100 bg-white">
          <ConnectGitHubButton connected={ghConnected} username={ghUsername} onStatusChange={refreshGitHub} />
        </div>

        <main className="flex-1 overflow-auto">
          <DashboardHeader
            userName={user?.name?.split(" ")[0] || "there"}
            prompt={prompt}
            generating={generating}
            isMultipage={isMultipage}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onToggleMultipage={setIsMultipage}
          />

          <ProjectsSection
            projects={projects}
            loading={loadingProjects}
            onOpen={setSelectedProject}
            onDelete={(id) => setDeleteTarget(id)}
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
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              This action cannot be undone. This will permanently delete your project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
