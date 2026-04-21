import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

// Try multiple endpoint shapes (GET with query, GET with path param, POST with body)
type Attempt = { method: "GET" | "POST"; url: string; body?: any };
function buildAttempts(reference: string): Attempt[] {
  const ref = encodeURIComponent(reference);
  return [
    { method: "GET",  url: `${GH_API_BASE}/v1/checkStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/transactionStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/orderStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/status?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/checkStatus/${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/transactionStatus/${ref}` },
    { method: "POST", url: `${GH_API_BASE}/v1/checkStatus`, body: { reference } },
    { method: "POST", url: `${GH_API_BASE}/v1/transactionStatus`, body: { reference } },
    { method: "POST", url: `${GH_API_BASE}/v1/orderStatus`, body: { reference } },
  ];
}

function extractStatus(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  return String(
    payload?.status ??
    payload?.data?.status ??
    payload?.data?.transaction_status ??
    payload?.data?.order_status ??
    payload?.transaction?.status ??
    payload?.result?.status ??
    ""
  ).toLowerCase().trim();
}

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

    const { data: order } = await supabase
      .from("orders")
      .select("id, gh_reference, order_ref, status")
      .eq("id", order_id)
      .single();
    if (!order || (!order.gh_reference && !order.order_ref)) {
      return new Response(JSON.stringify({ success: false, message: "Order has no provider reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try both gh_reference and order_ref (some orders may only have order_ref)
    const refs = Array.from(new Set([order.gh_reference, order.order_ref].filter(Boolean) as string[]));
    const diagnostics: any[] = [];
    let matchedStatus = "";
    let matchedPayload: any = null;
    let matchedAttempt: Attempt | null = null;

    outer:
    for (const reference of refs) {
      for (const attempt of buildAttempts(reference)) {
        try {
          const init: RequestInit = {
            method: attempt.method,
            headers: {
              Authorization: `Bearer ${GH_API_KEY}`,
              Accept: "application/json",
              ...(attempt.method === "POST" ? { "Content-Type": "application/json" } : {}),
            },
            ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
          };
          const r = await fetch(attempt.url, init);
          const text = await r.text();
          let payload: any = null;
          try { payload = JSON.parse(text); } catch { /* not JSON */ }

          const status = extractStatus(payload);
          const entry = {
            reference,
            method: attempt.method,
            url: attempt.url,
            http_status: r.status,
            extracted_status: status || null,
            raw: payload ?? text.slice(0, 500),
          };
          diagnostics.push(entry);
          console.log("ghconnect-status attempt:", JSON.stringify(entry));

          if (r.ok && status) {
            matchedStatus = status;
            matchedPayload = payload;
            matchedAttempt = attempt;
            break outer;
          }
        } catch (e: any) {
          const entry = {
            reference,
            method: attempt.method,
            url: attempt.url,
            error: e?.message || String(e),
          };
          diagnostics.push(entry);
          console.error("ghconnect-status attempt error:", JSON.stringify(entry));
        }
      }
    }

    let newStatus = order.status;
    if (["completed","success","delivered","successful"].includes(matchedStatus)) newStatus = "completed";
    else if (["failed","rejected","error","declined"].includes(matchedStatus)) newStatus = "failed";
    else if (["waiting","queued","queue"].includes(matchedStatus)) newStatus = "waiting";
    else if (["pending"].includes(matchedStatus)) newStatus = "pending";
    else if (["processing","in_progress","sending"].includes(matchedStatus)) newStatus = "processing";

    if (newStatus !== order.status && matchedStatus) {
      await supabase.from("orders").update({ status: newStatus }).eq("id", order_id);
      if (newStatus === "failed") {
        await supabase.rpc("refund_failed_order", { p_order_id: order_id });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      provider_status: matchedStatus || "unknown",
      new_status: newStatus,
      matched_endpoint: matchedAttempt ? `${matchedAttempt.method} ${matchedAttempt.url}` : null,
      raw: matchedPayload,
      diagnostics,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, message: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
