import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Ghi trạng thái push lần gần nhất cho người nhận (profiles.last_push_status / last_push_at).
async function recordPushStatus(supabase: any, profileId: string, status: string) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ last_push_status: status, last_push_at: new Date().toISOString() })
      .eq("id", profileId);
    if (error) console.error("recordPushStatus error", { profileId, status, error });
  } catch (err: any) {
    console.error("recordPushStatus throw", { profileId, status, message: err?.message });
  }
}

// statusCode = 0 → lỗi mạng/timeout (vẫn thử lại).
function isRetryable(statusCode: number): boolean {
  if (statusCode === 0) return true;             // timeout / network
  if (statusCode === 429) return true;           // rate limit
  return statusCode >= 500 && statusCode <= 599; // lỗi phía server
}

async function sendPush(
  profile: { id: string; push_subscription: any },
  payload: string,
  supabase: any,
  context: string,
  messageId?: string
) {
  const sub = profile.push_subscription;
  if (!sub) return;
  const MAX_ATTEMPTS = 3; // 1 lần gửi + tối đa 2 lần thử lại (cách 2s)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await webpush.sendNotification(sub, payload, { urgency: "high", TTL: 86400 });
      if (attempt > 1) console.log("Push retry ok", { context, messageId, profileId: profile.id, attempt });
      await recordPushStatus(supabase, profile.id, "ok");
      return;
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 0;
      console.error("Push error", {
        context,
        messageId: messageId || null,
        profileId: profile.id,
        statusCode: statusCode || null,
        name: err?.name || null,
        message: err?.message || String(err),
        attempt
      });
      // Chỉ 404/410 mới coi là subscription đã chết → xoá.
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("profiles")
          .update({ push_subscription: null, last_push_status: String(statusCode), last_push_at: new Date().toISOString() })
          .eq("id", profile.id);
        return;
      }
      if (isRetryable(statusCode) && attempt < MAX_ATTEMPTS) {
        await delay(2000);
        continue;
      }
      await recordPushStatus(supabase, profile.id, String(statusCode || "timeout"));
      return;
    }
  }
}

Deno.serve(async (req: Request) => {
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("x-cron-secret");
    if (authHeader !== cronSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC") || Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE") || Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidEmail = Deno.env.get("VAPID_EMAIL") || "mailto:admin@dinhichat.app";

    webpush.setVapidDetails(
      vapidEmail.startsWith("mailto:") ? vapidEmail : `mailto:${vapidEmail}`,
      vapidPublic,
      vapidPrivate
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: messages, error: msgsErr } = await supabase
      .from("messages")
      .select("*")
      .eq("remind_done", false)
      .neq("remind_mode", "none")
      .lte("next_remind_at", new Date().toISOString())
      .limit(50);

    if (msgsErr || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: "No pending reminders" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    for (const m of messages) {
      try {
        const { data: newerMessages, error: newerErr } = await supabase
          .from("messages")
          .select("id")
          .eq("sender_id", m.sender_id)
          .gt("created_at", m.created_at)
          .limit(1);

        if (newerErr) throw newerErr;
        if (newerMessages && newerMessages.length > 0) {
          const { error } = await supabase.from("messages")
            .update({ remind_done: true }).eq("id", m.id);
          if (error) throw error;
          continue;
        }

        const { data: replies } = await supabase
          .from("messages")
          .select("id")
          .neq("sender_id", m.sender_id)
          .gt("created_at", m.created_at)
          .limit(1);

        if (replies && replies.length > 0) {
          const { error } = await supabase.from("messages")
            .update({ remind_done: true }).eq("id", m.id);
          if (error) throw error;
          continue;
        }

        const { data: targetProfiles } = await supabase
          .from("profiles")
          .select("id, push_subscription")
          .neq("id", m.sender_id)
          .not("push_subscription", "is", null);
          
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", m.sender_id)
          .single();

        const senderName = senderProfile?.name || "DiNhiChat";

        if (targetProfiles && targetProfiles.length > 0) {
          const reminderPayload = JSON.stringify({
            title: senderName,
            body: "Cục dàng ơi! Dô rep tin nhắn kìaa"
          });
          
          for (const target of targetProfiles) {
            await sendPush(target, reminderPayload, supabase, "remind", m.id);
          }
        }

        const newCount = (m.remind_count || 0) + 1;
        const mode = m.remind_mode;
        
        let done = false;
        if (mode === '1' && newCount >= 1) done = true;
        else if (mode === '2' && newCount >= 2) done = true;

        if (done) {
          const { error } = await supabase.from("messages")
            .update({ remind_count: newCount, remind_done: true }).eq("id", m.id);
          if (error) throw error;
        } else {
          // Two-time and continuous modes repeat every minute; continuous stops on reply.
          const nextRemind = new Date(Date.now() + 60000).toISOString();
          const { error } = await supabase.from("messages")
            .update({ remind_count: newCount, next_remind_at: nextRemind }).eq("id", m.id);
          if (error) throw error;
        }

      } catch (err) {
        console.error("Error processing message", m.id, err);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: messages.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});
