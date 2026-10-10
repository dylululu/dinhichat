import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendPush(profile: { id: string; push_subscription: any }, payload: string, supabase: any) {
  const sub = profile.push_subscription;
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, payload, { urgency: "high", TTL: 3600 });
  } catch (err: any) {
    console.error("Push error for profile", profile.id, err);
    if (err.statusCode === 404 || err.statusCode === 410) {
      await supabase.from("profiles").update({ push_subscription: null }).eq("id", profile.id);
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
      .select("name")
      .eq("id", record.sender_id)
      .single();

    const senderName = senderProfile?.name || "Tin nhắn mới";
    const body = record.content || "📷 Đã gửi một ảnh";

    const { data: targetProfiles } = await supabase
      .from("profiles")
      .select("id, push_subscription")
      .neq("id", record.sender_id)
      .not("push_subscription", "is", null);

    if (!targetProfiles || targetProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    // Gửi push thông báo ngay
    const pushPayload = JSON.stringify({ title: senderName, body });
    for (const profile of targetProfiles) {
      await sendPush(profile, pushPayload, supabase);
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
