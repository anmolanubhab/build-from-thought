// path: src/components/dashboard/SettingsModal.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setNewPassword("");
    }
  }, [open, user?.name]);

  const saveName = async () => {
    if (!user || !name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() } as any)
        .eq("id", user.id);
      if (profileError) throw profileError;

      toast({ title: "Name updated" });
    } catch (err) {
      toast({
        title: "Couldn't update name",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      toast({ title: "Password updated" });
    } catch (err) {
      toast({
        title: "Couldn't update password",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--wb-surface)] border-[var(--wb-line)] sm:max-w-md wb-sans">
        <DialogHeader>
          <DialogTitle className="text-[var(--wb-text)]">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-email" className="text-[var(--wb-text-muted)]">Email</Label>
            <Input id="settings-email" value={user?.email || ""} disabled className="bg-[var(--wb-surface-raised)] border-[var(--wb-line)] text-[var(--wb-text-muted)]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-name" className="text-[var(--wb-text-muted)]">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                onClick={saveName}
                disabled={savingName || !name.trim() || name.trim() === user?.name}
                size="sm"
              >
                {savingName ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-password" className="text-[var(--wb-text-muted)]">New password</Label>
            <div className="flex gap-2">
              <Input
                id="settings-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
              <Button
                onClick={savePassword}
                disabled={savingPassword || !newPassword}
                size="sm"
              >
                {savingPassword ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
