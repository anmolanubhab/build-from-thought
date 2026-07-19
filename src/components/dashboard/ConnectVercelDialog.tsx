// path: src/components/dashboard/ConnectVercelDialog.tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { connectVercelWithToken } from "@/services/vercelDeploy";
import { ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export default function ConnectVercelDialog({ open, onClose, onConnected }: Props) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setToken("");
    onClose();
  };

  const handleConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      await connectVercelWithToken(token.trim());
      toast({ title: "Vercel connected" });
      onConnected();
      handleClose();
    } catch (err) {
      toast({
        title: "Couldn't connect",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your Vercel account</DialogTitle>
          <DialogDescription>
            Paste a Vercel token. It's used only to deploy your projects — it's never shown again after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="vercel-pat">Access Token</Label>
          <Input
            id="vercel-pat"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your Vercel token"
          />
          <a
            href="https://vercel.com/account/tokens"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
          >
            Create a token in your Vercel account <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConnect} disabled={loading || !token.trim()}>
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
