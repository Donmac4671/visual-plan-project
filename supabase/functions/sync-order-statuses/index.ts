import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

type Attempt = { method: "GET" | "POST"; url: string; body?: any };
function buildAttempts(reference: string): Attempt[] {
  const ref = encodeURIComponent(reference);
  return [
    { method: "GET",  url: `${GH_API_BASE}/v1/checkStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/transactionStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/orderStatus?reference=${ref}` },
    { method: "GET",  url: `${GH_API_BASE}/v1/status?reference=${ref}` },
    { method: "POST", url: `${GH_API_BASE}/v1/checkStatus`, body: { reference } },
    { method: "POST", url: `${GH_API_BASE}/v1/transactionStatus`, body: { reference } },
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

function mapStatus(raw: string, current: string): string {
  if (["completed","success","delivered","successful"].includes(raw)) return "completed";
  if (["failed","rejected","error","declined"].includes(raw)) return "failed";
  if (["waiting","queued","queue","onhold","on_hold","on-hold"].includes(raw)) return "waiting";
  if (["pending"].includes(raw)) return "pending";
  if (["processing","in_progress","sending","inprogress"].includes(raw)) return "processing";
  return current;
}

function parseBundleSizeGb(bundle: string): number {
  const value = parseFloat(String(bundle).replace(/[^\d.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const isServiceRequest = authHeader === `Bearer ${serviceKey}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const unsubmittedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: unsubmittedOrders, error: unsubmittedError } = await supabase
      .from("orders")
      .select("id, order_ref, network, phone_number, bundle_size, status")
      .in("status", ["processing", "waiting"])
      .is("gh_reference", null)
      .gte("created_at", unsubmittedCutoff)
      .limit(25);

    if (unsubmittedError) throw unsubmittedError;

    const submitResults: any[] = [];
    for (const order of unsubmittedOrders ?? []) {
      // Skip manual-delivery networks
      const netId = String(order.network || "").toLowerCase().trim().replace(/\s+/g, "-");
      if (["airtime", "mashup", "vs", "mashup-data", "mashup-combo"].includes(netId)) continue;
      try {
        const resp = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            network_id: order.network,
            phone: order.phone_number,
            bundle_size_gb: parseBundleSizeGb(order.bundle_size),
          }),
        });
        const result = await resp.json().catch(() => ({}));
        submitResults.push({ order_ref: order.order_ref, sent: resp.ok, status: resp.status, result });
      } catch (e: any) {
        submitResults.push({ order_ref: order.order_ref, sent: false, error: e?.message || "Unknown error" });
      }
    }

    // Get all non-final orders from the last 7 days
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, gh_reference, order_ref, network, status")
      .in("status", ["pending", "processing", "waiting"])
      .gte("created_at", sevenDaysAgo)
      .limit(100);

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    const results: any[] = [];

    for (const order of orders) {
      const netId = String(order.network || "").toLowerCase().trim().replace(/\s+/g, "-");
      if (["airtime", "mashup", "vs", "mashup-data", "mashup-combo"].includes(netId)) {
        results.push({ order_ref: order.order_ref, skipped: true, reason: "manual delivery network" });
        continue;
      }

      const refs = Array.from(new Set([order.gh_reference, order.order_ref].filter(Boolean) as string[]));
      if (refs.length === 0) continue;

      let matchedStatus = "";
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
            const s = extractStatus(payload);
            if (r.ok && s) { matchedStatus = s; break outer; }
          } catch { /* try next */ }
        }
      }

      if (!matchedStatus) {
        results.push({ order_ref: order.order_ref, provider_status: "unknown" });
        continue;
      }
      const newStatus = mapStatus(matchedStatus, order.status);
      if (newStatus !== order.status) {
        await supabase.from("orders").update({ status: newStatus }).eq("id", order.id);
        if (newStatus === "failed") {
          await supabase.rpc("refund_failed_order", { p_order_id: order.id });
        }
        updated++;
        results.push({ order_ref: order.order_ref, from: order.status, to: newStatus, provider: matchedStatus });
      }
    }

    console.log(`sync-order-statuses: submitted=${submitResults.length} checked=${orders.length} updated=${updated}`);
    if (!isServiceRequest) {
      return new Response(JSON.stringify({ submitted: submitResults.length, checked: orders.length, updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ submitted: submitResults.length, checked: orders.length, updated, submitResults, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-order-statuses error:", e);
    return new Response(JSON.stringify({ success: false, message: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
