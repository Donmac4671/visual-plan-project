import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all pending orders
    const { data: pendingOrders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending");

    if (fetchError) throw fetchError;

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ message: "No pending orders to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update all pending orders to processing
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "processing" })
      .eq("status", "pending");

    if (updateError) throw updateError;

    // Trigger fulfill-order for each order
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const results = [];

    for (const order of pendingOrders) {
      try {
        // Extract sizeGB from bundle_size string like "5GB"
        const sizeMatch = order.bundle_size.match(/(\d+(?:\.\d+)?)/);
        const bundleSizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 1;

        const resp = await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            network_id: order.network,
            phone: order.phone_number,
            bundle_size_gb: bundleSizeGb,
          }),
        });
        const result = await resp.json();
        results.push({ order_ref: order.order_ref, result });
      } catch (e) {
        results.push({ order_ref: order.order_ref, error: e.message });
      }
    }

    return new Response(JSON.stringify({ processed: pendingOrders.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
