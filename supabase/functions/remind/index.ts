import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
        const { data: replies } = await supabase
          .from("messages")
          .select("id")
          .neq("sender_id", m.sender_id)
          .gt("created_at", m.created_at)
          .limit(1);

        if (replies && replies.length > 0) {
          await supabase.from("messages").update({ remind_done: true }).eq("id", m.id);
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
            await sendPush(target, reminderPayload, supabase);
          }
        }

        const newCount = (m.remind_count || 0) + 1;
        const mode = m.remind_mode;
        
        let done = false;
        if (mode === '1' && newCount >= 1) done = true;
        else if (mode === '2' && newCount >= 2) done = true;
        else if (mode === 'loop' && newCount >= 20) done = true;

        if (done) {
          await supabase.from("messages").update({ remind_count: newCount, remind_done: true }).eq("id", m.id);
        } else {
          // interval '60 seconds'
          const nextRemind = new Date(Date.now() + 60000).toISOString();
          await supabase.from("messages").update({ remind_count: newCount, next_remind_at: nextRemind }).eq("id", m.id);
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
