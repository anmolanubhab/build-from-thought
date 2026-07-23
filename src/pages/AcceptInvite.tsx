// path: src/pages/AcceptInvite.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, XCircle } from "lucide-react";

const AcceptInvite = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !id) return;

    if (!user) {
      localStorage.setItem("pending_workspace_invitation_id", id);
      navigate(`/signup?invite=${id}`, { replace: true });
      return;
    }

    supabase.rpc("accept_workspace_invitation", { p_invitation_id: id }).then(({ data, error: rpcError }) => {
      if (rpcError || !data) {
        setError(rpcError?.message || "That invitation isn't valid for this account.");
        return;
      }
      const workspace = data as { id: string; name: string };
      localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, workspace.id);
      toast({ title: "Joined workspace", description: `You're now a member of "${workspace.name}".` });
      navigate("/dashboard", { replace: true });
    });
  }, [isLoading, user, id, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <div className="space-y-4">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="font-semibold text-gray-900">Couldn't accept invitation</p>
            <p className="text-sm text-gray-500">
              {error} Make sure you're signed in with the email address this invitation was sent to.
            </p>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 text-blue-600 mx-auto animate-spin" />
            <p className="text-sm text-gray-500">Accepting invitation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
