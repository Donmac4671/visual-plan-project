import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No order items supplied" }), { status: 400, headers: jsonHeaders });
    }

    const orderIds: string[] = [];
    const results: any[] = [];

    for (const item of items) {
      console.log(`Processing item:`, JSON.stringify(item));

      // Call the RPC to create order and deduct wallet
      const { data: orderId, error: rpcError } = await supabase.rpc("pay_with_wallet", {
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message, orderIds }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      const orderIdString = String(orderId);
      orderIds.push(orderIdString);

      // Check if this is Airtime or Mashup
      const isAirtimeOrMashup = item.network_id === "airtime" || item.network_id === "mashup";

      if (isAirtimeOrMashup) {
        // Update order to completed immediately
        await supabase
          .from("orders")
          .update({ status: "completed", gh_reference: `${item.network_id}-${Date.now()}` })
          .eq("id", orderIdString);

        results.push({
          orderId: orderIdString,
          status: "completed",
          product: item.network_id,
        });
        console.log(`✅ ${item.network_id} order ${orderIdString} completed`);
      } else {
        // Call fulfill-order for data bundles
        const fulfillResp = await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_id: orderIdString,
            network_id: item.network_id,
            phone: item.phone,
            bundle_size_gb: item.bundle_size_gb,
          }),
        });

        const fulfillResult = await fulfillResp.json();
        results.push({
          orderId: orderIdString,
          status: fulfillResult.status || "processing",
          product: item.network_id,
        });
        console.log(`📡 Data order ${orderIdString} sent to fulfill-order`);
      }
    }

    return new Response(JSON.stringify({ status: "ok", orderIds, results }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
