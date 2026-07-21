// path: src/services/profile.ts
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  location: string | null;
  is_public: boolean;
  language: string;
  chat_suggestions_enabled: boolean;
  generation_sound_enabled: boolean;
}

export async function fetchOwnProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, banner_url, location, is_public, language, chat_suggestions_enabled, generation_sound_enabled",
    )
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Profile;
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name can't be empty.");
  const { error: authError } = await supabase.auth.updateUser({ data: { name: trimmed } });
  if (authError) throw new Error(authError.message);
  const { error } = await supabase.from("profiles").update({ display_name: trimmed } as any).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateLocation(userId: string, location: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ location: location.trim() || null } as any).eq("id", userId);
  if (error) throw new Error(error.message);
}

const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/;

/** Maps a unique-constraint violation to a friendly message, matching the workspace-handle convention. */
export async function updateUsername(userId: string, username: string): Promise<string> {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error("Usernames must be 3-30 characters: lowercase letters, numbers, hyphens, and underscores only.");
  }
  const { error } = await supabase.from("profiles").update({ username: normalized } as any).eq("id", userId);
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw new Error(error.message);
  }
  return normalized;
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<Pick<Profile, "is_public" | "chat_suggestions_enabled" | "generation_sound_enabled">>,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(prefs as any).eq("id", userId);
  if (error) throw new Error(error.message);
}

const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

async function uploadProfileMedia(kind: "avatar" | "banner", userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_MEDIA_BYTES) throw new Error("Image must be under 3MB.");

  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const url = await uploadProfileMedia("avatar", userId, file);
  const { error } = await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", userId);
  if (error) throw new Error(error.message);
  return url;
}

export async function uploadBanner(userId: string, file: File): Promise<string> {
  const url = await uploadProfileMedia("banner", userId, file);
  const { error } = await supabase.from("profiles").update({ banner_url: url } as any).eq("id", userId);
  if (error) throw new Error(error.message);
  return url;
}

/** Guarded server-side: refuses if the caller solely owns a shared workspace, to protect other members' data. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error(error.message);
}
