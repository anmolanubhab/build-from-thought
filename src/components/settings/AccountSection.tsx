// path: src/components/settings/AccountSection.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOwnProfile,
  updateDisplayName,
  updateLocation,
  updateUsername,
  updatePreferences,
  uploadAvatar,
  uploadBanner,
  deleteOwnAccount,
  type Profile,
} from "@/services/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Camera, Loader2, ShieldCheck, ShieldOff, User as UserIcon } from "lucide-react";
import SettingsCard, { SettingsRow } from "./SettingsCard";

export default function AccountSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [location, setLocation] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [savingPref, setSavingPref] = useState<string | null>(null);

  const [twoFactorOn, setTwoFactorOn] = useState<boolean | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingProfile(true);
    fetchOwnProfile(user.id)
      .then((p) => {
        setProfile(p);
        setLocation(p.location || "");
        setUsername(p.username || "");
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [user?.id]);

  useEffect(() => {
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => setTwoFactorOn(!!data?.totp?.some((f) => f.status === "verified")))
      .catch(() => setTwoFactorOn(null));
  }, []);

  const saveName = async () => {
    if (!user || !name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      await updateDisplayName(user.id, name.trim());
      setProfile((p) => (p ? { ...p, display_name: name.trim() } : p));
      toast({ title: "Name updated" });
    } catch (err) {
      toast({ title: "Couldn't update name", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const saveLocation = async () => {
    if (!user) return;
    setSavingLocation(true);
    try {
      await updateLocation(user.id, location);
      toast({ title: "Location updated" });
    } catch (err) {
      toast({ title: "Couldn't update location", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingLocation(false);
    }
  };

  const saveUsername = async () => {
    if (!user || !username.trim() || username.trim() === (profile?.username || "")) return;
    setSavingUsername(true);
    try {
      const normalized = await updateUsername(user.id, username);
      setUsername(normalized);
      setProfile((p) => (p ? { ...p, username: normalized } : p));
      toast({ title: "Username updated" });
    } catch (err) {
      toast({ title: "Couldn't update username", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingUsername(false);
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
      toast({ title: "Couldn't update password", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      toast({ title: "Avatar updated" });
    } catch (err) {
      toast({ title: "Couldn't upload avatar", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploadingBanner(true);
    try {
      const url = await uploadBanner(user.id, file);
      setProfile((p) => (p ? { ...p, banner_url: url } : p));
      toast({ title: "Banner updated" });
    } catch (err) {
      toast({ title: "Couldn't upload banner", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setUploadingBanner(false);
    }
  };

  const togglePref = async (key: "is_public" | "chat_suggestions_enabled" | "generation_sound_enabled", value: boolean) => {
    if (!user || !profile) return;
    const prev = profile[key];
    setProfile({ ...profile, [key]: value });
    setSavingPref(key);
    try {
      await updatePreferences(user.id, { [key]: value });
    } catch (err) {
      setProfile((p) => (p ? { ...p, [key]: prev } : p));
      toast({ title: "Couldn't save preference", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingPref(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteOwnAccount();
      toast({ title: "Account deleted" });
      await logout();
      navigate("/");
    } catch (err) {
      toast({ title: "Couldn't delete account", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirm("");
    }
  };

  return (
    <div className="space-y-5">
      {/* Profile: banner, avatar, name, location */}
      <SettingsCard className="!p-0 overflow-hidden">
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadingBanner}
          title="Change banner"
          className="relative w-full h-28 bg-gradient-to-br from-blue-500 to-cyan-400 bg-cover bg-center flex items-center justify-center group"
          style={profile?.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            {uploadingBanner ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <span className="opacity-0 group-hover:opacity-100 text-xs text-white flex items-center gap-1 transition-opacity">
                <Camera className="h-3.5 w-3.5" /> Change banner
              </span>
            )}
          </div>
        </button>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change avatar"
            className="relative -mt-8 w-16 h-16 rounded-2xl border-4 border-white flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-cyan-400 bg-cover bg-center overflow-hidden"
            style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          >
            {uploadingAvatar ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : !profile?.avatar_url ? (
              <UserIcon className="h-6 w-6 text-white" />
            ) : null}
          </button>

          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-gray-600">Full name</Label>
              <div className="flex gap-2">
                <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500/30" />
                <Button onClick={saveName} disabled={savingName || !name.trim() || name.trim() === user?.name} className="bg-blue-600 text-white hover:bg-blue-700">
                  {savingName ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-location" className="text-gray-600">Location</Label>
              <div className="flex gap-2">
                <Input id="account-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30" />
                <Button onClick={saveLocation} disabled={savingLocation || location === (profile?.location || "")} variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50">
                  {savingLocation ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Username */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Username</h3>
        <p className="text-xs text-gray-500 mb-4">Identifies you to other members inside shared workspaces.</p>
        <div className="flex gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="your-username"
            maxLength={30}
            className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30"
          />
          <Button onClick={saveUsername} disabled={savingUsername || !username.trim() || username.trim() === (profile?.username || "")} className="bg-blue-600 text-white hover:bg-blue-700">
            {savingUsername ? "Saving..." : "Save"}
          </Button>
        </div>
      </SettingsCard>

      {/* Email */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Email</h3>
        <div className="space-y-1.5">
          <Label htmlFor="account-email" className="text-gray-600">Email address</Label>
          <Input id="account-email" value={user?.email || ""} disabled className="bg-gray-50 border-gray-200 text-gray-500" />
        </div>
      </SettingsCard>

      {/* Profile visibility */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Profile visibility</h3>
        <p className="text-xs text-gray-500 mb-1">Controls what other members of your shared workspaces see.</p>
        <SettingsRow
          label="Show my name and avatar to workspace members"
          description={profile?.is_public === false ? "You currently appear as \"Member\" to others." : "Other members see your real name and avatar."}
        >
          {!loadingProfile && profile && (
            <Switch checked={profile.is_public} disabled={savingPref === "is_public"} onCheckedChange={(v) => togglePref("is_public", v)} />
          )}
        </SettingsRow>
      </SettingsCard>

      {/* Preferences */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Preferences</h3>
        <p className="text-xs text-gray-500 mb-1">Personalize how the editor behaves for you.</p>
        <SettingsRow label="Language" description="English (US) — more languages are on the way.">
          <span className="text-xs text-gray-400 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200">English (US)</span>
        </SettingsRow>
        <SettingsRow label="Chat suggestions" description="Show quick prompt suggestions while you type in the editor.">
          {!loadingProfile && profile && (
            <Switch checked={profile.chat_suggestions_enabled} disabled={savingPref === "chat_suggestions_enabled"} onCheckedChange={(v) => togglePref("chat_suggestions_enabled", v)} />
          )}
        </SettingsRow>
        <SettingsRow label="Generation complete sound" description="Play a short sound when a generation finishes.">
          {!loadingProfile && profile && (
            <Switch checked={profile.generation_sound_enabled} disabled={savingPref === "generation_sound_enabled"} onCheckedChange={(v) => togglePref("generation_sound_enabled", v)} />
          )}
        </SettingsRow>
      </SettingsCard>

      {/* Linked accounts */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Linked accounts</h3>
        <p className="text-xs text-gray-500 mb-4">How you sign in to WebdevsAI.</p>
        <SettingsRow label="Password" description="Email & password sign-in">
          <div className="flex gap-2">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 w-44" />
            <Button onClick={savePassword} disabled={savingPassword || !newPassword} variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50">
              {savingPassword ? "..." : "Update"}
            </Button>
          </div>
        </SettingsRow>
      </SettingsCard>

      {/* Security */}
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Security</h3>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-start gap-3 min-w-0">
            {twoFactorOn ? (
              <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldOff className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {twoFactorOn === null ? "Checking two-factor status..." : twoFactorOn ? "Two-factor authentication is enabled" : "Two-factor authentication is not enabled"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Sensitive actions may require re-authentication.</p>
            </div>
          </div>
          <Link to="/dashboard/settings?section=privacy" className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 shrink-0">
            Manage →
          </Link>
        </div>
      </SettingsCard>

      {/* Danger zone */}
      <SettingsCard className="border-red-200">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Danger zone</h3>
        <p className="text-xs text-gray-500 mb-4">
          Deleting your account permanently removes your projects, workspace memberships, and profile. This can't be undone.
        </p>
        <AlertDialog onOpenChange={(open) => !open && setDeleteConfirm("")}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account, personal projects, and profile. If you solely own a
                shared workspace with other members, this will be blocked until you remove them or transfer
                ownership. Type <span className="font-semibold text-gray-900">delete</span> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete"
              className="bg-white border-gray-200 text-gray-900"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleteConfirm.trim().toLowerCase() !== "delete" || deleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleting ? "Deleting..." : "Delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCard>
    </div>
  );
}
