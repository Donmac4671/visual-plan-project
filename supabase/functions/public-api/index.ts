import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Extract bearer token
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const apiKeyHeader = req.headers.get("x-api-key") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : apiKeyHeader.trim();

    if (!token || !token.startsWith("dmh_")) {
      return json({ error: "Missing or invalid API token. Send 'Authorization: Bearer dmh_live_...'" }, 401);
    }

    const { data: userId, error: verErr } = await supabase.rpc("verify_api_token", { p_token: token });
    if (verErr || !userId) return json({ error: "Invalid or revoked API token" }, 401);

    const url = new URL(req.url);
    // Strip the function prefix so paths are clean: /balance, /orders, /orders/<ref>
    const path = url.pathname.replace(/^\/+/, "").replace(/^public-api\/?/, "");
    const segments = path.split("/").filter(Boolean);

    // GET /balance
    if (req.method === "GET" && segments[0] === "balance") {
      const { data, error } = await supabase
        .from("profiles")
        .select("wallet_balance, tier, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ balance: Number(data?.wallet_balance ?? 0), tier: data?.tier, name: data?.full_name });
    }

    // GET /orders   or   GET /orders/<ref>
    if (req.method === "GET" && segments[0] === "orders") {
      if (segments[1]) {
        const ref = segments[1];
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_ref, network, phone_number, bundle_size, amount, status, payment_method, created_at")
          .eq("user_id", userId)
          .or(`order_ref.eq.${ref},id.eq.${ref}`)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Order not found" }, 404);
        return json({ order: data });
      }
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_ref, network, phone_number, bundle_size, amount, status, payment_method, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data });
    }

    // POST /orders
    if (req.method === "POST" && segments[0] === "orders") {
      let body: any = {};
      try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

      const network = String(body.network || "").trim().toLowerCase();
      const phone = String(body.phone || body.phone_number || "").trim();
      const bundle = String(body.bundle || body.bundle_size || "").trim();
      const amount = Number(body.amount);

      if (!network) return json({ error: "Missing 'network' (e.g. 'mtn','telecel','airteltigo')" }, 400);
      if (!/^0\d{9}$/.test(phone)) return json({ error: "Invalid 'phone'. Must be a 10-digit Ghana number starting with 0." }, 400);
      if (!bundle) return json({ error: "Missing 'bundle' (e.g. '1GB','2GB')" }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Invalid 'amount'" }, 400);

      const { data, error } = await supabase.rpc("api_place_wallet_order", {
        p_user: userId,
        p_network: network,
        p_phone: phone,
        p_bundle: bundle,
        p_amount: amount,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, order: data }, 201);
    }

    return json({
      error: "Unknown endpoint",
      hint: "Try GET /balance, GET /orders, GET /orders/{ref}, POST /orders",
    }, 404);
  } catch (e: any) {
    console.error("public-api error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
