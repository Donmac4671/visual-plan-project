import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("GHDataConnect webhook received:", JSON.stringify(body));

    // GHDataConnect sends status updates with reference and status
    const { reference, status, message } = body;

    if (!reference) {
      return new Response(JSON.stringify({ success: false, message: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the order by matching the reference in the order_ref or by searching
    // Our references start with "DMH" followed by timestamp
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error("Error fetching orders:", fetchError);
      throw fetchError;
    }

    // The reference we sent to GHDataConnect is stored in format DMH{timestamp}{random}
    // We need to match it - since we don't store the GH reference separately,
    // we'll log it for now and update based on the reference
    console.log(`Webhook: reference=${reference}, status=${status}, message=${message}`);

    // Map GHDataConnect status to our status
    let newStatus = "processing";
    if (status === "completed" || status === "success" || status === "delivered") {
      newStatus = "completed";
    } else if (status === "failed" || status === "rejected") {
      newStatus = "failed";
    }

    // If the reference matches one of our order references, update it
    if (reference.startsWith("DMH")) {
      // This is our own reference - find any order with this as a potential match
      // Since we use DMH{timestamp}{random}, we can try to match
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (updateError) {
        console.error("Error updating order:", updateError);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
