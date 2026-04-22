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
    // Shared-secret verification
    const expectedSecret = Deno.env.get("GHCONNECT_WEBHOOK_SECRET");
    if (expectedSecret) {
      const url = new URL(req.url);
      const providedSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("X-Webhook-Secret") ||
        url.searchParams.get("key") ||
        url.searchParams.get("secret");
      if (providedSecret !== expectedSecret) {
        console.warn("ghconnect-webhook: invalid or missing secret");
        return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("GHDataConnect webhook received:", JSON.stringify(body));

    const references = Array.from(new Set([
      body.reference,
      body.trxref,
      body.order_ref,
      body.orderRef,
      body.client_reference,
      body.data?.reference,
      body.data?.trxref,
      body.data?.order_ref,
      body.data?.orderRef,
      body.data?.client_reference,
    ].filter(Boolean).map((value) => String(value).trim())));
    const rawStatus = String(
      body.status ??
      body.data?.status ??
      body.transaction?.status ??
      body.result?.status ??
      body.data?.transaction_status ??
      body.data?.order_status ??
      ""
    ).toLowerCase().trim();

    if (references.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map GHDataConnect status → our status (mirrors provider 1:1)
    let newStatus = "processing";
    if (["completed", "success", "delivered", "successful"].includes(rawStatus)) {
      newStatus = "completed";
    } else if (["failed", "rejected", "error", "declined"].includes(rawStatus)) {
      newStatus = "failed";
    } else if (["waiting", "queued", "queue"].includes(rawStatus)) {
      newStatus = "waiting";
    } else if (["pending"].includes(rawStatus)) {
      newStatus = "pending";
    } else if (["processing", "in_progress", "sending"].includes(rawStatus)) {
      newStatus = "processing";
    }

    let order: { id: string } | null = null;
    for (const reference of references) {
      const { data: ghOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("gh_reference", reference)
        .maybeSingle();

      if (ghOrder) {
        order = ghOrder;
        break;
      }

      const { data: localOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("order_ref", reference)
        .maybeSingle();

      if (localOrder) {
        order = localOrder;
        break;
      }
    }

    if (!order) {
      console.log(`No matching order for references: ${references.join(", ")}`);
      return new Response(JSON.stringify({ success: true, message: "No matching order found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    if (updateError) {
      console.error("Error updating order:", updateError);
    } else {
      console.log(`Order ${order.id} updated to ${newStatus}`);
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
