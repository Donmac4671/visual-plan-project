import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });

    const { target_user_id } = await req.json().catch(() => ({}));
    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: jsonHeaders });
    }
    if (target_user_id === callerId) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account here" }), { status: 400, headers: jsonHeaders });
    }

    // Clean up dependent rows first (no FK cascades configured)
    await admin.from("orders").delete().eq("user_id", target_user_id);
    await admin.from("transactions").delete().eq("user_id", target_user_id);
    await admin.from("wallet_topups").delete().eq("user_id", target_user_id);
    await admin.from("complaints").delete().eq("user_id", target_user_id);
    await admin.from("chat_messages").delete().eq("user_id", target_user_id);
    await admin.from("agent_applications").delete().eq("user_id", target_user_id);
    await admin.from("push_subscriptions").delete().eq("user_id", target_user_id);
    await admin.from("referrals").delete().eq("referred_id", target_user_id);
    await admin.from("referrals").delete().eq("referrer_id", target_user_id);
    await admin.from("user_roles").delete().eq("user_id", target_user_id);
    await admin.from("profiles").delete().eq("user_id", target_user_id);

    const { error: delErr } = await admin.auth.admin.deleteUser(target_user_id);
    if (delErr) {
      console.error("auth deleteUser failed", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: jsonHeaders });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
