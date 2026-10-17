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
    const payload = await req.json();
    const record = payload.record || payload;

    if (!record || !record.sender_id) {
      return new Response(JSON.stringify({ error: "Missing record fields" }), {
        headers: { "Content-Type": "application/json" },
        status: 400
      });
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

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("name, push_subscription")
      .eq("id", record.sender_id)
      .single();

    const senderName = senderProfile?.name || "Tin nhắn mới";
    const body = record.is_sticker ? "🎟️ Đã gửi một sticker" : (record.content || "📷 Đã gửi một ảnh");

    const { data: targetProfiles } = await supabase
      .from("profiles")
      .select("id, push_subscription")
      .neq("id", record.sender_id)
      .not("push_subscription", "is", null);

    const senderEndpoint = senderProfile?.push_subscription?.endpoint;
    const uniqueTargets = new Map<string, { id: string; push_subscription: any }>();
    for (const profile of targetProfiles || []) {
      const endpoint = profile.push_subscription?.endpoint;
      if (!endpoint || endpoint === senderEndpoint || uniqueTargets.has(endpoint)) continue;
      uniqueTargets.set(endpoint, profile);
    }
    const recipients = [...uniqueTargets.values()];

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    // Gửi push thông báo ngay
    const pushPayload = JSON.stringify({ title: senderName, body });
    for (const profile of recipients) {
      await sendPush(profile, pushPayload, supabase, "notify", record.id);
    }

    const msgCreatedAt = record.created_at || new Date().toISOString();
    const senderId = record.sender_id;

// reminder code removed

    return new Response(JSON.stringify({ success: true }), {
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
