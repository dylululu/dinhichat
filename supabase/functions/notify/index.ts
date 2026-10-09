import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record = payload.record || payload;

    if (!record || !record.sender_id || !record.content) {
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

    // Get sender name
    const { data: senderProfile, error: senderErr } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", record.sender_id)
      .single();

    if (senderErr) {
      console.error("Error fetching sender profile:", senderErr);
    }
    const senderName = senderProfile?.name || "Tin nhắn mới";

    // Get push_subscription of other profiles (not sender) where push_subscription is not null
    const { data: targetProfiles, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, push_subscription")
      .neq("id", record.sender_id)
      .not("push_subscription", "is", null);

    if (fetchErr) {
      console.error("Error fetching target profiles:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      });
    }

    if (!targetProfiles || targetProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers to notify" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    const pushPayload = JSON.stringify({
      title: senderName,
      body: record.content
    });

    for (const profile of targetProfiles) {
      const sub = profile.push_subscription;
      if (!sub) continue;

      try {
        await webpush.sendNotification(sub, pushPayload, {
          urgency: "high",
          TTL: 3600
        });
      } catch (err: any) {
        console.error("Error sending push to profile", profile.id, err);
        // On 404 or 410 (expired / unsubscribed), clear push_subscription
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.warn(`Subscription 404/410 for profile ${profile.id}, resetting to null`);
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({ push_subscription: null })
            .eq("id", profile.id);
          if (updateErr) {
            console.error("Failed to reset subscription for profile", profile.id, updateErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (err: any) {
    console.error("Unhandled error in notify function:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});
