// path: src/pages/JoinWorkspace.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { joinWorkspaceByCode } from "@/services/workspaces";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, XCircle } from "lucide-react";

const JoinWorkspace = () => {
  const { code } = useParams<{ code: string }>();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !code) return;

    if (!user) {
      localStorage.setItem("pending_workspace_invite", code);
      navigate(`/signup?workspace=${code}`, { replace: true });
      return;
    }

    joinWorkspaceByCode(code)
      .then((workspace) => {
        localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, workspace.id);
        toast({ title: "Joined workspace", description: `You're now a member of "${workspace.name}".` });
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "That invite link isn't valid.");
      });
  }, [isLoading, user, code, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <div className="space-y-4">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="font-semibold text-gray-900">Couldn't join workspace</p>
            <p className="text-sm text-gray-500">{error}</p>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 text-blue-600 mx-auto animate-spin" />
            <p className="text-sm text-gray-500">Joining workspace...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinWorkspace;
