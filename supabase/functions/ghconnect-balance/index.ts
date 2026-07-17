import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CANDIDATE_ENDPOINTS = [
  "https://ghdataconnect.com/api/developer/check-balance",
  "https://ghdataconnect.com/api/developer/balance",
  "https://ghdataconnect.com/api/wallet-balance",
  "https://ghdataconnect.com/api/balance",
  "https://ghdataconnect.com/api/user/balance",
  "https://ghdataconnect.com/api/v1/balance",
  "https://ghdataconnect.com/api/v1/getWalletBalance",
];

const extractBalance = (payload: any): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.balance,
    payload.wallet_balance,
    payload.walletBalance,
    payload?.data?.balance,
    payload?.data?.wallet_balance,
    payload?.data?.walletBalance,
    payload?.data?.data?.balance,
    payload?.user?.balance,
    payload?.user?.wallet_balance,
  ];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = typeof c === "number" ? c : parseFloat(String(c).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, message: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const diagnostics: Array<{ url: string; status: number; body: string }> = [];
    let balance: number | null = null;
    let matchedPayload: any = null;

    for (const url of CANDIDATE_ENDPOINTS) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${GH_API_KEY}`, Accept: "application/json" },
        });
        const text = await response.text();
        let payload: any = null;
        try { payload = JSON.parse(text); } catch { /* ignore */ }
        diagnostics.push({ url, status: response.status, body: text.slice(0, 300) });
        console.log(`GH balance attempt ${url} → ${response.status}: ${text.slice(0, 200)}`);

        if (response.ok && payload) {
          const b = extractBalance(payload);
          if (b !== null) {
            balance = b;
            matchedPayload = payload;
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        diagnostics.push({ url, status: 0, body: msg });
      }
    }

    if (balance === null) {
      return new Response(
        JSON.stringify({ success: false, message: "Unable to retrieve balance from GHDataConnect", diagnostics }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: { balance, raw: matchedPayload } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Balance check error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
