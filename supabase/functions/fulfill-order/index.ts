import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const NETWORK_MAP: Record<string, { key: string; endpoint: string }> = {
  mtn: { key: "mtn", endpoint: "/v1/purchaseBundle" },
  telecel: { key: "telecel", endpoint: "/v1/purchaseBundle" },
  "at-bigtime": { key: "atbigtime", endpoint: "/v1/purchaseBundle" },
  "at-premium": { key: "atpremium", endpoint: "/v1/purchaseBundle" },
};

const RequestSchema = z.object({
  order_id: z.string().uuid(),
  network_id: z.string(),
  phone: z.string().min(10).max(13),
  bundle_size_gb: z.number().positive(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) {
      throw new Error("GHDATACONNECT_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, message: "Invalid request", errors: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, network_id, phone, bundle_size_gb } = parsed.data;

    // Normalize network name: "AT BIG TIME" → "at-bigtime", "AT PREMIUM" → "at-premium"
    const networkKey = network_id.toLowerCase().replace(/\s+/g, "-");
    const networkConfig = NETWORK_MAP[networkKey];
    if (!networkConfig) {
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `DMH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const capacity = bundle_size_gb;

    const requestBody: Record<string, unknown> = { network: networkConfig.key, reference, msisdn: phone, capacity };

    console.log(`Fulfilling order ${order_id}: ${network_id} ${bundle_size_gb}GB to ${phone}`);

    const response = await fetch(`${GH_API_BASE}${networkConfig.endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log(`GHDataConnect response for order ${order_id}:`, JSON.stringify(result));

    if (result.success) {
      // Store the actual GH reference from the response
      const actualRef = result.data?.reference ?? result.data?.id ?? result.reference ?? reference;
      console.log(`GH Ref extracted: ${actualRef}, full data:`, JSON.stringify(result.data));
      await supabase.from("orders").update({ gh_reference: String(actualRef) }).eq("id", order_id);
      return new Response(JSON.stringify({ success: true, data: result.data, reference: actualRef }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.error(`GHDataConnect order failed [${response.status}]:`, JSON.stringify(result));
      // Mark the order as failed so user sees it
      await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
      return new Response(JSON.stringify({ success: false, message: result.message || "Order failed on provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fulfill order error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
