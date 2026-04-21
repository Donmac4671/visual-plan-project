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
    const expectedAmount = typeof body.amount === "number" ? body.amount : NaN;
    if (!reference || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid reference or amount" }), { status: 400, headers: jsonHeaders });
    }

    // Verify with Paystack
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
    // Allow small tolerance for the 2% fee or rounding (paid >= expected - 0.01)
    if (paidGhs + 0.01 < expectedAmount) {
      return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Idempotency: ensure we haven't already credited this reference
    const { data: existing } = await admin
      .from("wallet_topups")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ status: "already_credited" }), { status: 200, headers: jsonHeaders });
    }

    const { error: rpcErr } = await admin.rpc("complete_paystack_topup_for_user", {
      p_user_id: userId,
      p_amount: expectedAmount,
      p_reference: reference,
    });
    if (rpcErr) {
      console.error("complete_paystack_topup_for_user failed:", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ status: "credited", amount: expectedAmount }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("paystack-verify-topup error:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
