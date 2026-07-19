import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FG_API_KEY = Deno.env.get("FGAMALL_API_KEY");
    if (!FG_API_KEY) throw new Error("FGAMALL_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, message: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    const resp = await fetch("https://fgamall.com/api/v2/balance", {
      method: "GET",
      headers: { "x-api-key": FG_API_KEY, "x-timestamp": ts, Accept: "application/json" },
    });
    const text = await resp.text();
    let payload: any = {};
    try { payload = JSON.parse(text); } catch { /* ignore */ }

    if (!resp.ok || !payload?.success) {
      return new Response(JSON.stringify({
        success: false, message: "Unable to retrieve balance from fgamall", provider_status: resp.status, body: text.slice(0, 300),
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const balance = Number(payload.wallet_balance ?? 0);
    return new Response(JSON.stringify({ success: true, data: { balance, raw: payload } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Balance check error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
