import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const NETWORK_KEYS: Record<string, string[]> = {
  mtn: ["MTN", "mtn"],
  telecel: ["TELECEL", "telecel"],
  "at-bigtime": ["AT_BIGTIME", "AT-BIGTIME", "atbigtime", "at_bigtime", "at-bigtime", "AIRTELTIGO_BIGTIME"],
  "at-premium": [
    "AT_PREMIUM",
    "AT-PREMIUM",
    "AIRTELTIGO_PREMIUM",
    "AIRTELTIGOPREMIUM",
    "AT_PREMIUM_BUNDLE",
    "AIRTELTIGO_PREMIUM_BUNDLE",
    "premium",
    "PREMIUM",
    "atpremium",
    "at_premium",
    "at-premium",
    "airteltigo_premium",
    "airteltigopremium",
  ],
};

const ENDPOINT = "/v1/purchaseBundle";

function normalizeNetworkKey(networkId: string): string {
  return networkId.toLowerCase().trim().replace(/\s+/g, "-");
}

function isNetworkValidationError(result: any, status: number): boolean {
  const message = String(result?.message ?? "").toLowerCase();
  const networkErrors = Array.isArray(result?.errors?.network)
    ? result.errors.network.join(" ").toLowerCase()
    : String(result?.errors?.network ?? "").toLowerCase();
  return (
    status === 422 &&
    (message.includes("validation") ||
      networkErrors.includes("network") ||
      networkErrors.includes("invalid") ||
      networkErrors.includes("selected"))
  );
}

const RequestSchema = z.object({
  order_id: z.string().uuid(),
  network_id: z.string(),
  phone: z.string().min(10).max(13),
  bundle_size_gb: z.number().positive(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("=== STEP 1: Function started ===");

    const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
    console.log("=== STEP 2: GH_API_KEY exists?", !!GH_API_KEY);
    if (!GH_API_KEY) throw new Error("GHDATACONNECT_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    console.log("=== STEP 3: Supabase client created ===");

    const authHeader = req.headers.get("Authorization");
    console.log("=== STEP 4: Auth header exists?", !!authHeader);
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRequest = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("=== STEP 5: isServiceRequest?", isServiceRequest);

    let user = null;
    let authError = null;

    if (!isServiceRequest) {
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
      console.log("=== STEP 6: User authenticated?", !!user);
    }

    if (!isServiceRequest && (authError || !user)) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("=== STEP 7: Request body received:", JSON.stringify(body));

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      console.log("=== STEP 8: Validation FAILED ===");
      return new Response(
        JSON.stringify({ success: false, message: "Invalid request", errors: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.log("=== STEP 8: Validation PASSED ===");

    const { order_id, network_id, phone, bundle_size_gb } = parsed.data;
    console.log("=== STEP 9: Order data:", { order_id, network_id, phone, bundle_size_gb });

    const networkKey = normalizeNetworkKey(network_id);
    const candidateKeys = NETWORK_KEYS[networkKey];
    console.log("=== STEP 10: networkKey:", networkKey);
    console.log("=== STEP 10b: candidateKeys:", candidateKeys);

    if (!candidateKeys) {
      console.log("=== STEP 11: Unknown network - RETURNING 400 ===");
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("=== STEP 11: Fetching order from database ===");
    const { data: orderRow } = await supabase
      .from("orders")
      .select("order_ref, user_id")
      .eq("id", order_id)
      .maybeSingle();

    console.log("=== STEP 12: Order found?", !!orderRow);
    console.log("=== STEP 12b: orderRow data:", orderRow);

    if (!orderRow) {
      console.log("=== STEP 13: Order not found - RETURNING 404 ===");
      return new Response(JSON.stringify({ success: false, message: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user?.id || null;
    console.log("=== STEP 14: userId:", userId);

    let isAdmin = isServiceRequest;
    console.log("=== STEP 15: isAdmin from service request:", isAdmin);

    if (!isAdmin && userId) {
      console.log("=== STEP 16: Checking user_roles for admin ===");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
      console.log("=== STEP 17: isAdmin after role check:", isAdmin);
    }

    console.log(
      "=== STEP 18: Checking permission - orderRow.user_id:",
      orderRow.user_id,
      "userId:",
      userId,
      "isAdmin:",
      isAdmin,
    );

    if (!isAdmin && orderRow.user_id !== userId) {
      console.log("=== STEP 19: Forbidden - RETURNING 403 ===");
      return new Response(JSON.stringify({ success: false, message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = orderRow.order_ref || `DMH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    console.log("=== STEP 20: Reference generated:", reference);

    await supabase.from("orders").update({ gh_reference: reference }).eq("id", order_id);
    console.log("=== STEP 21: Order updated with reference");

    console.log(`=== STEP 22: ABOUT TO CALL GHDATA for order ${order_id} ===`);

    let lastResult: any = null;
    let lastStatus = 0;
    const diagnostics: Array<{ key: string; status: number; message: string; errors?: any }> = [];
    let sawNetworkValidationError = false;

    console.log("=== STEP 23: Starting loop over candidate keys:", candidateKeys);

    for (const key of candidateKeys) {
      const requestBody = { network: key, reference, msisdn: phone, capacity: bundle_size_gb };
      console.log("=== STEP 24: Calling GHData with key:", key);
      console.log("=== STEP 24b: Request body:", JSON.stringify(requestBody));

      const response = await fetch(`${GH_API_BASE}${ENDPOINT}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GH_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("=== STEP 25: GHData response status:", response.status);
      lastStatus = response.status;
      lastResult = await response.json().catch(() => ({}));
      console.log("=== STEP 26: GHData response body:", JSON.stringify(lastResult));

      diagnostics.push({
        key,
        status: response.status,
        message: String(lastResult?.message ?? ""),
        errors: lastResult?.errors,
      });

      if (isNetworkValidationError(lastResult, response.status)) {
        sawNetworkValidationError = true;
        console.log("=== STEP 27: Network validation error detected ===");
      }

      if (lastResult?.success) {
        console.log("=== STEP 28: SUCCESS! Order fulfilled ===");
        const actualRef = lastResult.data?.reference ?? lastResult.data?.id ?? lastResult.reference ?? reference;
        const nextStatus = networkKey === "at-premium" ? "completed" : "processing";
        await supabase
          .from("orders")
          .update({ gh_reference: String(actualRef), status: nextStatus })
          .eq("id", order_id);
        return new Response(
          JSON.stringify({ success: true, data: lastResult.data, reference: actualRef, status: nextStatus }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const isAtPremium = networkKey === "at-premium";
      const msg = String(lastResult?.message ?? "").toLowerCase();
      const looksLikeNetworkError =
        msg.includes("network") ||
        msg.includes("invalid") ||
        msg.includes("not found") ||
        msg.includes("unsupported") ||
        response.status === 404 ||
        response.status === 422 ||
        response.status === 400;

      console.log("=== STEP 29: Should break?", !isAtPremium && !looksLikeNetworkError);
      if (!isAtPremium && !looksLikeNetworkError) break;
    }

    console.log("=== STEP 30: All attempts failed ===");

    if (networkKey === "at-premium" && sawNetworkValidationError) {
      console.log("=== STEP 31: AT Premium waiting for manual review ===");
      await supabase.from("orders").update({ status: "waiting", gh_reference: reference }).eq("id", order_id);
      return new Response(
        JSON.stringify({
          success: false,
          status: "waiting",
          message:
            "AT Premium was rejected by GHData network validation, so the order is waiting for manual/provider review instead of being failed/refunded.",
          provider_status: lastStatus,
          diagnostics,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("=== STEP 32: Marking as failed and refunding ===");
    await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
    await supabase.rpc("refund_failed_order", { p_order_id: order_id });

    return new Response(
      JSON.stringify({
        success: false,
        message: lastResult?.message || "Order failed on provider",
        provider_status: lastStatus,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("=== ERROR:", errorMessage);
    console.error("=== Full error:", error);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
