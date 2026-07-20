import { useState } from "react";
import { Github, Loader2, ExternalLink, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { startGitHubAuth, pushToGitHub, disconnectGitHub } from "@/services/github";
import { Project } from "@/lib/projects";

interface ConnectButtonProps {
  connected: boolean;
  username?: string;
  onStatusChange: () => void;
}

export function ConnectGitHubButton({ connected, username, onStatusChange }: ConnectButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await startGitHubAuth();
    } catch (err: any) {
      toast({ title: "Failed to connect GitHub", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGitHub();
      onStatusChange();
      toast({ title: "GitHub disconnected" });
    } catch (err: any) {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-700">
          <Github className="h-4 w-4" />
          <span className="font-medium">{username}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-xs text-gray-400 hover:text-red-500">
          <Unplug className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleConnect} disabled={loading} className="gap-1.5 text-xs">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
      Connect GitHub
    </Button>
  );
}

interface PushButtonProps {
  project: Project;
  connected: boolean;
}

export function PushToGitHubButton({ project, connected }: PushButtonProps) {
  const [open, setOpen] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [pushing, setPushing] = useState(false);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  const defaultName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

  const handleOpen = () => {
    setRepoName(defaultName);
    setRepoUrl(null);
    setOpen(true);
  };

  const handlePush = async () => {
    if (!repoName.trim()) return;
    setPushing(true);
    try {
      const url = await pushToGitHub(project.id, repoName.trim());
      setRepoUrl(url);
      toast({ title: "Pushed to GitHub! 🎉", description: "Your project is now on GitHub." });
    } catch (err: any) {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  if (!connected) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen} className="h-8 gap-1.5 text-xs border-gray-200">
        <Github className="h-3.5 w-3.5" /> Push to GitHub
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Github className="h-5 w-5" /> Push to GitHub
            </DialogTitle>
          </DialogHeader>

          {repoUrl ? (
            <div className="py-4 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Github className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-700 font-medium">Repository created successfully!</p>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {repoUrl}
              </a>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Repository name</label>
                <Input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-project"
                  className="bg-gray-50 border-gray-200"
                  disabled={pushing}
                />
              </div>
              <p className="text-xs text-gray-400">
                This will create a public repo and push your project's HTML, CSS, and React code.
              </p>
            </div>
          )}

          <DialogFooter>
            {repoUrl ? (
              <Button onClick={() => setOpen(false)} className="w-full">Done</Button>
            ) : (
              <Button onClick={handlePush} disabled={pushing || !repoName.trim()} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                {pushing ? "Pushing..." : "Create & Push"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
