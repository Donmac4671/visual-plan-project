import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FG_API_BASE = "https://fgamall.com/api/v2";

// Map internal network keys → fgamall network name (matches GET /networks `name`)
const FG_NETWORK_NAME: Record<string, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  "at-bigtime": "AirtelTigo",
  "at-premium": "AirtelTigo",
};

function normalizeNetworkKey(networkId: string): string {
  return networkId.toLowerCase().trim().replace(/\s+/g, "-");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fgGet(path: string, apiKey: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(`${FG_API_BASE}${path}`, {
    method: "GET",
    headers: { "x-api-key": apiKey, "x-timestamp": ts, Accept: "application/json" },
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

async function fgPost(path: string, apiKey: string, secret: string, body: Record<string, unknown>, idemKey: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = JSON.stringify(body);
  const sig = await hmacSha256Hex(secret, `${ts}.${raw}`);
  const res = await fetch(`${FG_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-timestamp": ts,
      "x-signature": sig,
      "Idempotency-Key": idemKey,
      Accept: "application/json",
    },
    body: raw,
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

const RequestSchema = z.object({
  order_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FG_API_KEY = Deno.env.get("FGAMALL_API_KEY");
    const FG_SECRET = Deno.env.get("FGAMALL_SIGNING_SECRET");
    if (!FG_API_KEY || !FG_SECRET) throw new Error("FGAMALL_API_KEY / FGAMALL_SIGNING_SECRET not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRequest = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let user = null;
    if (!isServiceRequest) {
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, message: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { order_id } = parsed.data;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("order_ref, user_id, network, phone_number, bundle_size")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ success: false, message: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const network_id = String(order.network || "");
    const phone = String(order.phone_number || "");
    const sizeMatch = String(order.bundle_size || "").match(/(\d+(?:\.\d+)?)/);
    const bundle_size_gb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const volumeMb = Math.round(bundle_size_gb * 1000);
    const networkKey = normalizeNetworkKey(network_id);

    // Manual delivery — never send to provider
    if (["airtime", "mashup", "vs", "mashup-data", "mashup-combo"].includes(networkKey)) {
      await supabase.from("orders").update({
        status: "processing",
        gh_reference: `manual-${networkKey}-${Date.now()}`,
      }).eq("id", order_id);
      return new Response(JSON.stringify({
        success: true, status: "processing", message: `${network_id} order set to processing (manual delivery)`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const targetName = FG_NETWORK_NAME[networkKey];
    if (!targetName) {
      return new Response(JSON.stringify({ success: false, message: `Unknown network: ${network_id}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize
    const userId = user?.id || null;
    let isAdmin = isServiceRequest;
    if (!isAdmin && userId) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    }
    if (!isAdmin && order.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, message: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = order.order_ref || `DMH${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await supabase.from("orders").update({ gh_reference: reference }).eq("id", order_id);

    console.log(`📡 Fulfilling order ${order_id}: ${network_id} ${bundle_size_gb}GB (${volumeMb}MB) → ${phone}`);

    // Resolve network + package on fgamall
    const netsResp = await fgGet("/networks", FG_API_KEY);
    if (!netsResp.json?.success) {
      console.error("fgamall /networks failed:", netsResp.status, netsResp.text);
      throw new Error("Failed to fetch fgamall networks");
    }
    const nets: Array<{ id: number; name: string; type: string }> = netsResp.json.networks || [];
    const net = nets.find((n) => n.name.toLowerCase() === targetName.toLowerCase());
    if (!net) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
      await supabase.rpc("refund_failed_order", { p_order_id: order_id });
      return new Response(JSON.stringify({ success: false, message: `Network ${targetName} not available at provider` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // iShare path (AirtelTigo)
    if (net.type === "ishare") {
      const idem = crypto.randomUUID();
      const resp = await fgPost("/ishare/send", FG_API_KEY, FG_SECRET, {
        recipient_msisdn: phone,
        amount_mb: volumeMb,
        reference,
      }, idem);
      console.log(`📥 fgamall /ishare/send [${resp.status}]:`, resp.text.slice(0, 500));
      if (resp.json?.success) {
        const actualRef = resp.json.data?.reference ?? resp.json.transaction_code ?? reference;
        await supabase.from("orders").update({ gh_reference: String(actualRef), status: "processing" }).eq("id", order_id);
        return new Response(JSON.stringify({ success: true, reference: actualRef, status: "processing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
      await supabase.rpc("refund_failed_order", { p_order_id: order_id });
      return new Response(JSON.stringify({
        success: false, message: resp.json?.message || "iShare send failed", provider_status: resp.status,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Standard data buy: find package by volume
    const pkgsResp = await fgGet(`/packages/${net.id}`, FG_API_KEY);
    const pkgs: Array<{ id: number; volume_mb: number; volume_gb: number; price: number }> =
      pkgsResp.json?.packages || [];
    const pkg =
      pkgs.find((p) => p.volume_mb === volumeMb) ||
      pkgs.find((p) => Math.abs(p.volume_gb - bundle_size_gb) < 0.01);
    if (!pkg) {
      console.error(`No fgamall package for ${targetName} ${bundle_size_gb}GB (${volumeMb}MB)`);
      await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
      await supabase.rpc("refund_failed_order", { p_order_id: order_id });
      return new Response(JSON.stringify({ success: false, message: `No matching package at provider for ${targetName} ${bundle_size_gb}GB` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idem = crypto.randomUUID();
    const buyResp = await fgPost("/data/buy", FG_API_KEY, FG_SECRET, {
      network_id: net.id,
      volume_mb: pkg.volume_mb ?? volumeMb,
      package_id: pkg.id,
      recipient_msisdn: phone,
      reference,
    }, idem);
    console.log(`📥 fgamall /data/buy [${buyResp.status}]:`, buyResp.text.slice(0, 500));

    if (buyResp.json?.success) {
      const actualRef = buyResp.json.data?.reference ?? buyResp.json.transaction_code ?? reference;
      const nextStatus =
        networkKey === "at-premium" ? "completed"
        : networkKey === "telecel" ? "waiting"
        : "processing";
      await supabase.from("orders").update({ gh_reference: String(actualRef), status: nextStatus }).eq("id", order_id);
      return new Response(JSON.stringify({ success: true, reference: actualRef, status: nextStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error(`❌ fgamall data/buy failed for order ${order_id}:`, buyResp.text);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order_id);
    await supabase.rpc("refund_failed_order", { p_order_id: order_id });
    return new Response(JSON.stringify({
      success: false, message: buyResp.json?.message || "Order failed on provider", provider_status: buyResp.status,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("💥 Fulfill order error:", errorMessage);
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
