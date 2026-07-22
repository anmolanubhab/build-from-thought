// path: supabase/functions/telegram-webhook/index.ts
// Public webhook Telegram calls directly (no Supabase JWT — Telegram has no
// concept of our auth). Authenticated instead via the `secret_token` Telegram
// echoes back in the `X-Telegram-Bot-Api-Secret-Token` header, set once when
// registering the webhook (Bot API `setWebhook`) and stored here as
// TELEGRAM_WEBHOOK_SECRET for comparison.
//
// Flow this completes: a user clicked "Connect Telegram" in the app
// (telegram-connect), got a t.me deep link with a one-time code, and tapped
// Start in Telegram. Telegram then sends us that "/start <code>" message here.
// We verify the code against telegram_link_codes and, if valid, mark the
// connection live in connected_apps — completing the other half of the flow.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sendMessage(botToken: string, chatId: number | string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    // Best-effort — a failed reply shouldn't fail webhook processing (Telegram
    // would just retry the whole update, re-consuming an already-used code).
    console.error("Telegram sendMessage failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  // Always ack quickly with 200 once past auth — Telegram retries aggressively
  // on non-2xx, and we never want it retrying a message we've already handled.
  try {
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!webhookSecret || !botToken) {
      console.error("telegram-webhook: TELEGRAM_WEBHOOK_SECRET or TELEGRAM_BOT_TOKEN not configured");
      return json({ ok: true }); // 200 so Telegram doesn't hammer retries while misconfigured
    }
    const providedSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (providedSecret !== webhookSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const update = await req.json().catch(() => null);
    const message = update?.message;
    if (!message?.text || !message?.chat?.id) {
      return json({ ok: true }); // Non-text update (photo, edited message, etc.) — nothing for us to do.
    }

    const chatId = message.chat.id as number;
    const text = String(message.text).trim();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (text === "/disconnect") {
      const { data: existing } = await admin
        .from("connected_apps")
        .select("id, user_id")
        .eq("provider", "telegram")
        .eq("metadata->>chat_id", String(chatId))
        .maybeSingle();
      if (existing) {
        await admin.from("connected_apps").delete().eq("id", existing.id);
        await sendMessage(botToken, chatId, "You've been disconnected from WebdevsAI. Send /start from Settings → Devices & Apps to reconnect anytime.");
      } else {
        await sendMessage(botToken, chatId, "This Telegram account isn't connected to a WebdevsAI account.");
      }
      return json({ ok: true });
    }

    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const code = parts[1];
      if (!code) {
        await sendMessage(
          botToken,
          chatId,
          "👋 Welcome to WebdevsAI! Open Settings → Devices & Apps in the app and click \"Connect Telegram\" to link your account.",
        );
        return json({ ok: true });
      }

      const nowIso = new Date().toISOString();
      const { data: linkRow, error: linkError } = await admin
        .from("telegram_link_codes")
        .select("user_id, expires_at, used_at")
        .eq("code", code.toUpperCase())
        .maybeSingle();

      if (linkError || !linkRow || linkRow.used_at || linkRow.expires_at < nowIso) {
        await sendMessage(
          botToken,
          chatId,
          "❌ That link code is invalid or has expired. Generate a fresh one from Settings → Devices & Apps and try again.",
        );
        return json({ ok: true });
      }

      const { error: upsertError } = await admin.from("connected_apps").upsert(
        {
          user_id: linkRow.user_id,
          provider: "telegram",
          status: "connected",
          connected_at: nowIso,
          updated_at: nowIso,
          metadata: {
            chat_id: String(chatId),
            username: message.from?.username ?? null,
            first_name: message.from?.first_name ?? null,
          },
        },
        { onConflict: "user_id,provider" },
      );

      if (upsertError) {
        console.error("Failed to upsert connected_apps for telegram:", upsertError.message);
        await sendMessage(botToken, chatId, "Something went wrong linking your account. Please try again from WebdevsAI.");
        return json({ ok: true });
      }

      await admin.from("telegram_link_codes").update({ used_at: nowIso }).eq("code", code.toUpperCase());
      await sendMessage(
        botToken,
        chatId,
        "✅ Telegram connected! You'll now get project updates, AI build notifications, and deployment alerts here. Send /disconnect anytime to unlink.",
      );
      return json({ ok: true });
    }

    // Any other message — friendly default reply so the bot doesn't feel dead.
    await sendMessage(botToken, chatId, "I only understand /start <code> (from WebdevsAI → Settings → Devices & Apps) and /disconnect right now.");
    return json({ ok: true });
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return json({ ok: true }); // Still 200 — avoid Telegram retry storms on our own bugs.
  }
});
