// path: src/components/settings/InviteMembersDialog.tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { inviteWorkspaceMember } from "@/services/workspaces";
import { Loader2, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  onInvited: () => void;
}

export default function InviteMembersDialog({ open, onClose, workspaceId, workspaceName, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleClose = () => {
    setEmail("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await inviteWorkspaceMember(workspaceId, email.trim());
      toast({ title: "Invitation sent", description: `${email.trim()} can now accept the invite from their account.` });
      setEmail("");
      onInvited();
      handleClose();
    } catch (err) {
      toast({
        title: "Couldn't send invitation",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>Invite someone to "{workspaceName}" as an editor by email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={sending || !email.trim()} className="bg-blue-600 text-white hover:bg-blue-700">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
