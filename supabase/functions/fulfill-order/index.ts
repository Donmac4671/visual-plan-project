import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

// Multiple key candidates per network, tried in order until provider accepts.
const NETWORK_KEYS: Record<string, string[]> = {
  mtn: ["mtn"],
  telecel: ["telecel"],
  "at-bigtime": ["atbigtime", "at_bigtime", "at-bigtime"],
  "at-premium": ["atpremium", "at_premium", "at-premium", "airteltigo_premium", "airteltigopremium"],
};

const ENDPOINT = "/v1/purchaseBundle";

const RequestSchema = z.object({
  order_id: z.string().uuid(),
  network_id: z.string(),
  phone: z.string().min(10).max(13),
  bundle_size_gb: z.number().positive(),
});

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

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, message: "Invalid request", errors: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, network_id, phone, bundle_size_gb } = parsed.data;

    const networkKey = network_id.toLowerCase().replace(/\s+/g, "-");
    const candidateKeys = NETWORK_KEYS[networkKey];
    if (!candidateKeys) {
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `DMH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await supabase.from("orders").update({ gh_reference: reference }).eq("id", order_id);

    console.log(`Fulfilling order ${order_id}: ${network_id} ${bundle_size_gb}GB to ${phone}`);

    let lastResult: any = null;
    let lastStatus = 0;

    for (const key of candidateKeys) {
      const requestBody = { network: key, reference, msisdn: phone, capacity: bundle_size_gb };
      const response = await fetch(`${GH_API_BASE}${ENDPOINT}`, {
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
      console.log(`GH response (key=${key}, status=${response.status}):`, JSON.stringify(lastResult));

      if (lastResult?.success) {
        const actualRef = lastResult.data?.reference ?? lastResult.data?.id ?? lastResult.reference ?? reference;
        await supabase.from("orders").update({ gh_reference: String(actualRef) }).eq("id", order_id);
        return new Response(JSON.stringify({ success: true, data: lastResult.data, reference: actualRef }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only try alternates if the failure looks like an unknown-network rejection
      const msg = String(lastResult?.message ?? "").toLowerCase();
      const looksLikeNetworkError = msg.includes("network") || msg.includes("invalid") || response.status === 404 || response.status === 422;
      if (!looksLikeNetworkError) break;
    }

    // All attempts failed → mark failed and refund wallet
    console.error(`All GHDataConnect attempts failed for order ${order_id} [${lastStatus}]:`, JSON.stringify(lastResult));
    await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
    await supabase.rpc("refund_failed_order", { p_order_id: order_id });

    return new Response(JSON.stringify({ success: false, message: lastResult?.message || "Order failed on provider", provider_status: lastStatus }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fulfill order error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
