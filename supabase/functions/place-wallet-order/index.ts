import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Parse request body
    const body = await req.json();
    const items = body.items || [];

    console.log("📦 Received items:", JSON.stringify(items, null, 2));

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block any hidden (offline) bundles server-side
    const { data: hidden } = await admin.from("hidden_bundles").select("network_id, bundle_size");
    const hiddenSet = new Set((hidden ?? []).map((r: any) => `${r.network_id}::${r.bundle_size}`));

    // Block whole-network offline toggles server-side
    const TOGGLE_KEYS = [
      "mtn_enabled","telecel_enabled","at_premium_enabled","at_bigtime_enabled",
      "airtime_enabled","mashup_enabled","vs_enabled","mashup_data_enabled",
    ];
    const { data: toggles } = await admin.from("app_settings").select("key,value").in("key", TOGGLE_KEYS);
    const enabledMap: Record<string, boolean> = {};
    (toggles ?? []).forEach((r: any) => { enabledMap[r.key] = r.value !== false && r.value !== "false"; });
    const networkKey = (id: string) => {
      const k = (id || "").toLowerCase();
      if (k === "mtn") return "mtn_enabled";
      if (k === "telecel") return "telecel_enabled";
      if (k === "at-premium") return "at_premium_enabled";
      if (k === "at-bigtime") return "at_bigtime_enabled";
      if (k === "airtime") return "airtime_enabled";
      if (k === "mashup") return "mashup_enabled";
      if (k === "vs") return "vs_enabled";
      if (k === "mashup-data" || k === "mashup-combo") return "mashup_data_enabled";
      return null;
    };

    for (const item of items) {
      const key = `${item.network_id}::${item.bundle}`;
      if (hiddenSet.has(key)) {
        return new Response(JSON.stringify({ error: `${item.network} ${item.bundle} is currently offline. Please remove it from your cart.` }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tk = networkKey(item.network_id);
      if (tk && enabledMap[tk] === false) {
        return new Response(JSON.stringify({ error: `${item.network} is currently offline. Please try again later.` }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results = [];

    for (const item of items) {
      console.log(`🔄 Processing: ${item.network_id} for ${item.phone}`);

      // Call the RPC to create order and deduct wallet
      const { data: orderId, error: rpcError } = await supabase.rpc("pay_with_wallet", {
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
      });

      if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message, results }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderIdStr = String(orderId);
      console.log(`✅ Order created: ${orderIdStr}`);

      const networkId = String(item.network_id || "").toLowerCase().trim().replace(/\s+/g, "-");

      // Handle MTN, Airtime and Mashup - set to "processing" (manual delivery)
      if (["airtime", "mashup", "vs", "mashup-data", "mashup-combo"].includes(networkId)) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "processing",
            gh_reference: `${networkId}-manual-${Date.now()}`,
          })
          .eq("id", orderIdStr);

        if (updateError) {
          console.error("❌ Update Error:", updateError);
        } else {
          console.log(`✅ ${networkId} order ${orderIdStr} set to processing (manual delivery)`);
        }

        results.push({
          orderId: orderIdStr,
          product: networkId,
          status: "processing",
          message: `${networkId} order created - manual delivery required`,
        });
      } else {
        // ============================================================
        // 🔥 FIXED: Call fulfill-order for data bundles
        // Make sure to await the response properly
        // ============================================================
        console.log(`📡 Calling fulfill-order for data order ${orderIdStr}`);

        const fulfillResponse = await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: orderIdStr,
            network_id: item.network_id,
            phone: item.phone,
            bundle_size_gb: item.bundle_size_gb,
          }),
        });

        const fulfillResult = await fulfillResponse.json();
        console.log(`📡 fulfill-order response:`, fulfillResult);

        if (!fulfillResponse.ok) {
          console.error(`❌ fulfill-order failed: ${fulfillResponse.status}`, fulfillResult);
          // Don't fail the whole order, just log it
        }

        results.push({
          orderId: orderIdStr,
          product: item.network_id,
          status: fulfillResult.status || "processing",
          message: fulfillResult.message || "Order sent to GHData",
          gh_response: fulfillResult,
        });

        console.log(`✅ Data order ${orderIdStr} sent to fulfill-order`);
      }
    }

    console.log(`🎉 All orders processed successfully:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("💥 Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
