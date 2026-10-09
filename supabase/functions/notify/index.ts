import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

    // body: content if text, else image placeholder
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

    const pushPayload = JSON.stringify({ title: senderName, body });

    for (const profile of targetProfiles) {
      const sub = profile.push_subscription;
      if (!sub) continue;
      try {
        await webpush.sendNotification(sub, pushPayload, { urgency: "high", TTL: 3600 });
      } catch (err: any) {
        console.error("Push error for profile", profile.id, err);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("profiles").update({ push_subscription: null }).eq("id", profile.id);
        }
      }
    }

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
