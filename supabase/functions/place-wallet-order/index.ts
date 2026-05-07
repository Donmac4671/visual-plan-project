import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface WalletOrderItem {
  network: string;
  network_id: string;
  phone: string;
  bundle: string;
  bundle_size_gb: number;
  amount: number;
}

async function fulfillOrder(
  supabaseUrl: string,
  userToken: string,
  orderId: string,
  networkId: string,
  phone: string,
  bundleSizeGb: number,
) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      order_id: orderId,
      network_id: networkId,
      phone,
      bundle_size_gb: bundleSizeGb,
    }),
  });

  const result = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, result };
}

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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? (body.items as WalletOrderItem[]) : [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No order items supplied" }), { status: 400, headers: jsonHeaders });
    }

    for (const item of items) {
      if (
        typeof item.network !== "string" ||
        !item.network ||
        typeof item.network_id !== "string" ||
        !item.network_id ||
        typeof item.phone !== "string" ||
        !item.phone ||
        typeof item.bundle !== "string" ||
        !item.bundle ||
        typeof item.bundle_size_gb !== "number" ||
        item.bundle_size_gb <= 0 ||
        typeof item.amount !== "number" ||
        item.amount <= 0
      ) {
        return new Response(JSON.stringify({ error: "Invalid item shape" }), { status: 400, headers: jsonHeaders });
      }
    }

    const orderIds: string[] = [];
    const fulfillments: unknown[] = [];

    for (const item of items) {
      const { data: orderId, error } = await userClient.rpc("pay_with_wallet", {
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
      });

      if (error) {
        console.error("pay_with_wallet failed:", error);
        return new Response(JSON.stringify({ error: error.message, createdOrderIds: orderIds, fulfillments }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order was not created", createdOrderIds: orderIds, fulfillments }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }

      const orderIdString = String(orderId);
      orderIds.push(orderIdString);

      const isNonGh = ["mashup", "airtime"].includes(item.network_id.toLowerCase());

      if (isNonGh) {
        // Update order status to completed for Airtime/Mashup
        await userClient
          .from("orders")
          .update({ status: "completed", gh_reference: `non-gh-${Date.now()}` })
          .eq("id", orderIdString);

        fulfillments.push({
          orderId: orderIdString,
          ok: true,
          status: 200,
          result: { success: true, message: `${item.network_id} order completed` },
        });
        console.log(`${item.network_id} order ${orderIdString} completed locally`);
      } else {
        // Data bundle - call GHData
        const fulfillment = await fulfillOrder(
          supabaseUrl,
          token,
          orderIdString,
          item.network_id,
          item.phone,
          item.bundle_size_gb,
        );
        fulfillments.push({ orderId: orderIdString, ...fulfillment });
        console.log("Wallet order fulfillment result:", JSON.stringify({ orderId: orderIdString, fulfillment }));
      }
    }

    return new Response(JSON.stringify({ status: "ok", orderIds, fulfillments }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("place-wallet-order error:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
