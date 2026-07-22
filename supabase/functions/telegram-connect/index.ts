// path: supabase/functions/telegram-connect/index.ts
// Starts a Telegram linking flow for the calling user: generates a short-lived
// one-time code, stores it in telegram_link_codes, and returns a t.me deep link
// (t.me/<bot>?start=<code>). The user opens the link, Telegram sends /start
// <code> to our bot, and telegram-webhook (the other half of this flow)
// verifies the code and marks the connection live in connected_apps.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes — plenty of time to switch to Telegram and tap Start.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids user transcription errors
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return json({ error: "Telegram isn't configured yet on this workspace. Please try again later or contact support." }, 500);
    }

    // Resolve the bot's @username so we can build a t.me deep link. Cheap and
    // always-correct; this endpoint is only called when a user clicks "Connect".
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = await meRes.json();
    const botUsername: string | undefined = me?.result?.username;
    if (!meRes.ok || !botUsername) {
      console.error("Telegram getMe failed:", me);
      return json({ error: "Couldn't reach Telegram right now. Please try again in a moment." }, 502);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    // A user retrying "Connect" before their previous code expired would otherwise
    // accumulate unusable rows — clear their own unused codes first.
    await admin.from("telegram_link_codes").delete().eq("user_id", user.id).is("used_at", null);

    const { error: insertError } = await admin.from("telegram_link_codes").insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("Failed to create telegram link code:", insertError.message);
      return json({ error: "Couldn't start the Telegram connection. Please try again." }, 500);
    }

    return json({
      code,
      deep_link: `https://t.me/${botUsername}?start=${code}`,
      expires_at: expiresAt,
    });
  } catch (e) {
    console.error("telegram-connect error:", e);
    return json({ error: "Something went wrong starting the Telegram connection. Please try again." }, 500);
  }
});
