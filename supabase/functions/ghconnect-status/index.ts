import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";
// Try common status endpoints in order
const STATUS_ENDPOINTS = ["/v1/checkStatus", "/v1/transactionStatus", "/v1/orderStatus"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      return new Response(JSON.stringify({ success: false, message: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ success: false, message: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await supabase.from("orders").select("id, gh_reference, status").eq("id", order_id).single();
    if (!order || !order.gh_reference) {
      return new Response(JSON.stringify({ success: false, message: "Order has no provider reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lastResult: any = null;
    for (const ep of STATUS_ENDPOINTS) {
      const r = await fetch(`${GH_API_BASE}${ep}?reference=${encodeURIComponent(order.gh_reference)}`, {
        headers: { Authorization: `Bearer ${GH_API_KEY}`, Accept: "application/json" },
      });
      lastResult = await r.json().catch(() => ({}));
      if (r.ok && (lastResult?.status || lastResult?.data?.status)) break;
    }

    const raw = String(lastResult?.status ?? lastResult?.data?.status ?? "").toLowerCase().trim();
    let newStatus = order.status;
    if (["completed","success","delivered","successful"].includes(raw)) newStatus = "completed";
    else if (["failed","rejected","error","declined"].includes(raw)) newStatus = "failed";
    else if (["waiting","queued","queue"].includes(raw)) newStatus = "waiting";
    else if (["pending"].includes(raw)) newStatus = "pending";
    else if (["processing","in_progress","sending"].includes(raw)) newStatus = "processing";

    if (newStatus !== order.status) {
      await supabase.from("orders").update({ status: newStatus }).eq("id", order_id);
      if (newStatus === "failed") {
        await supabase.rpc("refund_failed_order", { p_order_id: order_id });
      }
    }

    return new Response(JSON.stringify({ success: true, provider_status: raw || "unknown", new_status: newStatus, raw: lastResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, message: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
