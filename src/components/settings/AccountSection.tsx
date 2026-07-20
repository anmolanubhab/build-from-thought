// path: src/components/settings/AccountSection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SettingsCard from "./SettingsCard";

export default function AccountSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  const saveName = async () => {
    if (!user || !name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { name: name.trim() } });
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
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-email" className="text-gray-600">Email</Label>
            <Input id="account-email" value={user?.email || ""} disabled className="bg-gray-50 border-gray-200 text-gray-500" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-name" className="text-gray-600">Full name</Label>
            <div className="flex gap-2">
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30"
              />
              <Button
                onClick={saveName}
                disabled={savingName || !name.trim() || name.trim() === user?.name}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {savingName ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Password</h3>
        <div className="space-y-1.5">
          <Label htmlFor="account-password" className="text-gray-600">New password</Label>
          <div className="flex gap-2">
            <Input
              id="account-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30"
            />
            <Button
              onClick={savePassword}
              disabled={savingPassword || !newPassword}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {savingPassword ? "Saving..." : "Update"}
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
