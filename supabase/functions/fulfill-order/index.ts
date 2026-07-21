import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";
const FULFILL_ENDPOINT = "/v1/purchaseBundle";

// Candidate network keys tried in order (GHData is picky about casing/format)
const NETWORK_KEYS: Record<string, string[]> = {
  mtn: [
    "MTN", "mtn", "MTN_BUNDLE",
    "MTN_DATA", "mtn_data", "MTN-DATA", "mtn-data",
    "MTN_SME", "mtn_sme", "MTN-SME", "mtn-sme",
    "MTN_CG", "mtn_cg", "MTN-CG", "mtn-cg",
    "MTN-AFA", "MTN_AFA", "mtn-afa", "mtn_afa",
  ],
  telecel: ["telecel", "TELECEL", "vodafone", "VODAFONE"],
  "at-bigtime": ["atbigtime", "at_bigtime", "at-bigtime", "AT_BIGTIME", "AIRTELTIGO_BIGTIME"],
  "at-premium": [
    "AT_PREMIUM", "AT-PREMIUM", "AIRTELTIGO_PREMIUM", "AIRTELTIGOPREMIUM",
    "AT_PREMIUM_BUNDLE", "AIRTELTIGO_PREMIUM_BUNDLE",
    "premium", "PREMIUM", "atpremium", "at_premium", "at-premium",
    "airteltigo_premium", "airteltigopremium",
  ],
};

function normalizeNetworkKey(networkId: string): string {
  return networkId.toLowerCase().trim().replace(/\s+/g, "-");
}

function isNetworkValidationError(result: any, status: number): boolean {
  const message = String(result?.message ?? "").toLowerCase();
  const networkErrors = Array.isArray(result?.errors?.network)
    ? result.errors.network.join(" ").toLowerCase()
    : String(result?.errors?.network ?? "").toLowerCase();
  return status === 422 && (
    message.includes("validation") ||
    networkErrors.includes("network") ||
    networkErrors.includes("invalid") ||
    networkErrors.includes("selected")
  );
}

const RequestSchema = z.object({
  order_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRequest = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let user = null;
    if (!isServiceRequest) {
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, message: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { order_id } = parsed.data;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("order_ref, user_id, network, phone_number, bundle_size")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ success: false, message: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const network_id = String(order.network || "");
    const phone = String(order.phone_number || "");
    const sizeMatch = String(order.bundle_size || "").match(/(\d+(?:\.\d+)?)/);
    const bundle_size_gb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const networkKey = normalizeNetworkKey(network_id);

    // Manual delivery — never send to provider
    if (["airtime", "mashup", "vs", "mashup-data", "mashup-combo"].includes(networkKey)) {
      await supabase.from("orders").update({
        status: "processing",
        gh_reference: `manual-${networkKey}-${Date.now()}`,
      }).eq("id", order_id);
      return new Response(JSON.stringify({
        success: true, status: "processing", message: `${network_id} order set to processing (manual delivery)`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const candidateKeys = NETWORK_KEYS[networkKey];
    if (!candidateKeys) {
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize
    const userId = user?.id || null;
    let isAdmin = isServiceRequest;
    if (!isAdmin && userId) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    }
    if (!isAdmin && order.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, message: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = order.order_ref || `DMH${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await supabase.from("orders").update({ gh_reference: reference }).eq("id", order_id);

    console.log(`📡 Fulfilling order ${order_id}: ${network_id} ${bundle_size_gb}GB → ${phone}`);

    let lastResult: any = null;
    let lastStatus = 0;
    let success = false;
    let actualRef: string = reference;
    let sawNetworkValidationError = false;

    for (const key of candidateKeys) {
      try {
        const requestBody = { network: key, reference, msisdn: phone, capacity: bundle_size_gb };
        const response = await fetch(`${GH_API_BASE}${FULFILL_ENDPOINT}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GH_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        lastStatus = response.status;
        lastResult = await response.json().catch(() => ({}));
        console.log(`📥 GHData response (key=${key}, status=${response.status}):`, JSON.stringify(lastResult).slice(0, 500));

        if (isNetworkValidationError(lastResult, response.status)) sawNetworkValidationError = true;

        if (lastResult?.success) {
          actualRef = lastResult.data?.reference ?? lastResult.data?.id ?? lastResult.reference ?? reference;
          success = true;
          break;
        }

        const msg = String(lastResult?.message ?? "").toLowerCase();
        const looksLikeNetworkError =
          msg.includes("network") || msg.includes("invalid") || response.status === 404 || response.status === 422;
        if (!looksLikeNetworkError) break;
      } catch (err) {
        console.error(`GHData fetch error (key=${key}):`, err);
      }
    }

    if (success) {
      const nextStatus =
        networkKey === "mtn" ? "pending"
        : networkKey === "at-premium" ? "completed"
        : networkKey === "telecel" ? "waiting"
        : "processing";
      await supabase.from("orders").update({ gh_reference: String(actualRef), status: nextStatus }).eq("id", order_id);
      return new Response(JSON.stringify({ success: true, reference: actualRef, status: nextStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Provider network-code changes should not auto-fail/refund orders that need manual follow-up.
    if (["mtn", "at-premium"].includes(networkKey) && sawNetworkValidationError) {
      const heldStatus = networkKey === "mtn" ? "pending" : "waiting";
      await supabase.from("orders").update({ status: heldStatus }).eq("id", order_id);
      return new Response(JSON.stringify({
        success: false, status: heldStatus,
        message: `${network_id} held for manual review (provider network validation error)`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.error(`❌ GHData purchase failed for order ${order_id}:`, JSON.stringify(lastResult));
    await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
    await supabase.rpc("refund_failed_order", { p_order_id: order_id });
    return new Response(JSON.stringify({
      success: false, message: lastResult?.message || "Order failed on provider", provider_status: lastStatus,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("💥 Fulfill order error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
