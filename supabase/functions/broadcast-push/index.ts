import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:donmacdatahub@gmail.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); }
  catch (e) { console.error("VAPID setup failed:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userRes.user.id;

    // Verify admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const url = String(body.url ?? "/dashboard");
    const audience = (["all", "general", "agent"] as const).includes(body.audience) ? body.audience : "all";

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "title and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve recipient user_ids
    let userIds: string[] = [];
    if (audience === "all") {
      const { data } = await admin.from("profiles").select("user_id");
      userIds = (data ?? []).map((r) => r.user_id);
    } else {
      const { data } = await admin.from("profiles").select("user_id").eq("tier", audience);
      userIds = (data ?? []).map((r) => r.user_id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, recipients: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull all push subscriptions for these users
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      icon: "/favicon.png",
      badge: "/favicon.png",
    });

    let sent = 0;
    const expired: string[] = [];

    if (subs && subs.length > 0) {
      // batch in chunks of 100 to avoid huge concurrency
      const chunks: typeof subs[] = [];
      for (let i = 0; i < subs.length; i += 100) chunks.push(subs.slice(i, i + 100));

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              sent++;
            } catch (e: any) {
              const status = e?.statusCode;
              if (status === 404 || status === 410) expired.push(s.id);
              else console.error("broadcast push error:", status, e?.message);
            }
          }),
        );
      }
    }

    if (expired.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expired);
    }

    // Log the broadcast
    await admin.from("broadcasts").insert({
      title,
      message,
      url,
      audience,
      sent_by: userId,
      recipients_count: sent,
    });

    return new Response(JSON.stringify({ success: true, sent, recipients: userIds.length, expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("broadcast-push error:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
