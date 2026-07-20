import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const BALANCE_ENDPOINTS = [
  "/developer/check-balance",
  "/v1/checkBalance",
  "/v1/balance",
  "/v1/wallet-balance",
  "/wallet-balance",
];

function extractBalance(payload: any): number | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.balance,
    payload.wallet_balance,
    payload.data?.balance,
    payload.data?.wallet_balance,
    payload.result?.balance,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

    const diagnostics: any[] = [];
    for (const path of BALANCE_ENDPOINTS) {
      try {
        const resp = await fetch(`${GH_API_BASE}${path}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${GH_API_KEY}`, Accept: "application/json" },
        });
        const text = await resp.text();
        let payload: any = null;
        try { payload = JSON.parse(text); } catch { /* ignore */ }
        diagnostics.push({ path, status: resp.status, sample: text.slice(0, 200) });
        if (!resp.ok) continue;
        const balance = extractBalance(payload);
        if (balance !== null) {
          return new Response(JSON.stringify({ success: true, data: { balance, raw: payload } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        diagnostics.push({ path, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({
      success: false, message: "Unable to retrieve balance from GHData", diagnostics,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Balance check error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
