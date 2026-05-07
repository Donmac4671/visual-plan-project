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

    // Parse request body
    const body = await req.json();
    const items = body.items || [];

    console.log("Received items:", JSON.stringify(items, null, 2));

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of items) {
      console.log(`Processing: ${item.network_id} for ${item.phone}`);

      // Call the RPC to create order and deduct wallet
      const { data: orderId, error: rpcError } = await supabase.rpc("pay_with_wallet", {
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
      });

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderIdStr = String(orderId);

      // Handle Airtime and Mashup - mark as completed immediately
      if (item.network_id === "airtime" || item.network_id === "mashup") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "completed",
            gh_reference: `${item.network_id}-${Date.now()}`,
          })
          .eq("id", orderIdStr);

        if (updateError) {
          console.error("Update Error:", updateError);
        }

        results.push({
          orderId: orderIdStr,
          product: item.network_id,
          status: "completed",
          message: `${item.network_id} order completed`,
        });

        console.log(`✅ ${item.network_id} order ${orderIdStr} completed`);
      } else {
        // Call fulfill-order for data bundles
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
        results.push({
          orderId: orderIdStr,
          product: item.network_id,
          status: fulfillResult.status || "processing",
          message: fulfillResult.message || "Order sent for processing",
        });

        console.log(`📡 Data order ${orderIdStr} sent to fulfill-order`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
