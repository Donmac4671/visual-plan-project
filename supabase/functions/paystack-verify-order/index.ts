import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface CartItem {
  network: string;
  phone: string;
  bundle: string;
  amount: number;
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY not configured" }), { status: 500, headers: jsonHeaders });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    const items = Array.isArray(body.items) ? (body.items as CartItem[]) : [];
    if (!reference || items.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid reference or items" }), { status: 400, headers: jsonHeaders });
    }

    // Validate items shape
    for (const item of items) {
      if (
        typeof item.network !== "string" || !item.network ||
        typeof item.phone !== "string" || !item.phone ||
        typeof item.bundle !== "string" || !item.bundle ||
        typeof item.amount !== "number" || item.amount <= 0
      ) {
        return new Response(JSON.stringify({ error: "Invalid item shape" }), { status: 400, headers: jsonHeaders });
      }
    }

    const expectedTotal = items.reduce((sum, i) => sum + i.amount, 0);

    // Verify Paystack reference
    const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const verifyData = await verifyResp.json();
    if (!verifyResp.ok || !verifyData?.status || verifyData?.data?.status !== "success") {
      console.error("Paystack verify failed:", verifyData);
      return new Response(JSON.stringify({ error: "Payment not verified" }), { status: 402, headers: jsonHeaders });
    }
    const paidGhs = Number(verifyData.data.amount) / 100;
    const currency = String(verifyData.data.currency || "").toUpperCase();
    if (currency !== "GHS") {
      return new Response(JSON.stringify({ error: "Invalid currency" }), { status: 400, headers: jsonHeaders });
    }
    // Tolerate the 2% Paystack fee buffer the client adds
    if (paidGhs + 0.01 < expectedTotal) {
      return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Idempotency: refuse to reuse a reference that already has orders associated
    const { data: existingOrders } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .ilike("description", `%${reference}%`)
      .limit(1);
    // The transactions table doesn't store reference directly today, so also check:
    const { data: existingTopups } = await admin
      .from("wallet_topups")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (existingTopups || (existingOrders && existingOrders.length > 0)) {
      return new Response(JSON.stringify({ error: "Reference already used" }), { status: 409, headers: jsonHeaders });
    }

    const orderIds: string[] = [];
    for (const item of items) {
      const { data, error } = await admin.rpc("pay_order_with_paystack_for_user", {
        p_user_id: userId,
        p_network: item.network,
        p_phone: item.phone,
        p_bundle: item.bundle,
        p_amount: item.amount,
        p_reference: reference,
      });
      if (error) {
        console.error("pay_order_with_paystack_for_user failed:", error);
        return new Response(JSON.stringify({ error: error.message, createdOrderIds: orderIds }), { status: 500, headers: jsonHeaders });
      }
      if (data) orderIds.push(data as string);
    }

    return new Response(JSON.stringify({ status: "ok", orderIds }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("paystack-verify-order error:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
