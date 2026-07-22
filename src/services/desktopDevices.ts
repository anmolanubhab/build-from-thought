// path: src/services/desktopDevices.ts
import { supabase } from "@/integrations/supabase/client";

export interface DesktopDevice {
  id: string;
  deviceName: string;
  os: string;
  appVersion: string | null;
  lastActive: string;
}

/** Devices registered by the (future) WebdevsAI desktop app. Empty until that app ships. */
export async function fetchDesktopDevices(userId: string): Promise<DesktopDevice[]> {
  const { data, error } = await supabase
    .from("desktop_devices")
    .select("id, device_name, os, app_version, last_active")
    .eq("user_id", userId)
    .order("last_active", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { id: string; device_name: string; os: string; app_version: string | null; last_active: string }) => ({
    id: row.id,
    deviceName: row.device_name,
    os: row.os,
    appVersion: row.app_version,
    lastActive: row.last_active,
  }));
}

export async function disconnectDesktopDevice(deviceId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("desktop_devices")
    .delete()
    .eq("id", deviceId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't remove this device — try refreshing the page.");
  }
}
