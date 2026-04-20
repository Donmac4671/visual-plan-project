import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Authoritative pricing data — keep in sync with src/lib/data.ts
const NETWORKS = [
  {
    id: "mtn", name: "MTN",
    bundles: [
      { size: "1GB", agent: 4.60, general: 5 },
      { size: "2GB", agent: 9.30, general: 10 },
      { size: "3GB", agent: 13.90, general: 15 },
      { size: "4GB", agent: 18.50, general: 20 },
      { size: "5GB", agent: 23.20, general: 25 },
      { size: "6GB", agent: 27.80, general: 30 },
      { size: "8GB", agent: 37, general: 40 },
      { size: "10GB", agent: 43.50, general: 46 },
      { size: "15GB", agent: 64, general: 67 },
      { size: "20GB", agent: 84, general: 88 },
      { size: "25GB", agent: 105, general: 109 },
      { size: "30GB", agent: 126, general: 130 },
      { size: "40GB", agent: 164, general: 170 },
      { size: "50GB", agent: 205, general: 210 },
    ],
  },
  {
    id: "telecel", name: "TELECEL",
    bundles: [
      { size: "2GB", agent: 10.20, general: 11 },
      { size: "3GB", agent: 15.40, general: 16.50 },
      { size: "5GB", agent: 23, general: 24.50 },
      { size: "10GB", agent: 42, general: 44 },
      { size: "15GB", agent: 62, general: 65 },
      { size: "20GB", agent: 82, general: 85 },
      { size: "25GB", agent: 100, general: 105 },
      { size: "30GB", agent: 123, general: 127 },
      { size: "40GB", agent: 163, general: 167 },
      { size: "50GB", agent: 202, general: 207 },
    ],
  },
  {
    id: "at-bigtime", name: "AT BIG TIME",
    bundles: [
      { size: "15GB", agent: 58, general: 60 },
      { size: "20GB", agent: 65, general: 68 },
      { size: "30GB", agent: 75, general: 80 },
      { size: "40GB", agent: 86, general: 92 },
      { size: "50GB", agent: 95, general: 104 },
      { size: "60GB", agent: 106, general: 116 },
      { size: "70GB", agent: 138, general: 143 },
      { size: "80GB", agent: 152, general: 158 },
      { size: "90GB", agent: 163, general: 170 },
      { size: "100GB", agent: 177, general: 184 },
      { size: "130GB", agent: 222, general: 230 },
      { size: "140GB", agent: 248, general: 256 },
      { size: "150GB", agent: 275, general: 285 },
      { size: "200GB", agent: 370, general: 380 },
    ],
  },
  {
    id: "at-premium", name: "AT PREMIUM",
    bundles: [
      { size: "1GB", agent: 4.40, general: 4.80 },
      { size: "2GB", agent: 8.90, general: 9.60 },
      { size: "3GB", agent: 13.40, general: 14.40 },
      { size: "4GB", agent: 17.80, general: 19.20 },
      { size: "5GB", agent: 22.20, general: 24 },
      { size: "6GB", agent: 26.80, general: 28.80 },
      { size: "7GB", agent: 31.30, general: 33.60 },
      { size: "8GB", agent: 35.70, general: 38.40 },
      { size: "10GB", agent: 41.20, general: 43.20 },
      { size: "12GB", agent: 50, general: 55 },
      { size: "15GB", agent: 63, general: 67 },
      { size: "20GB", agent: 82, general: 85.40 },
      { size: "25GB", agent: 105, general: 109.40 },
      { size: "30GB", agent: 125, general: 129.60 },
    ],
  },
];

function buildPricingText(tier: "agent" | "general" | "guest"): string {
  return NETWORKS.map((n) => {
    const lines = n.bundles.map((b) => {
      if (tier === "agent") return `  ${b.size}: ₵${b.agent.toFixed(2)}`;
      if (tier === "general") return `  ${b.size}: ₵${b.general.toFixed(2)}`;
      // guest: show general price only (default public price)
      return `  ${b.size}: ₵${b.general.toFixed(2)}`;
    }).join("\n");
    return `${n.name}:\n${lines}`;
  }).join("\n\n");
}

// Strip markdown asterisks/underscores so chat reads as plain conversational text
function cleanText(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Try to load user context (wallet, tier, recent orders) using their auth token
    let userContext = "User is not signed in.";
    let userTier: "agent" | "general" | "guest" = "guest";
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, tier, wallet_balance, agent_code, referral_code")
            .eq("user_id", user.id)
            .maybeSingle();
          const { data: orders } = await supabase
            .from("orders")
            .select("order_ref, network, bundle_size, phone_number, amount, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

          const tier = profile?.tier || "general";
          userTier = tier === "agent" ? "agent" : "general";
          const ordersText = (orders || []).length
            ? orders!.map((o: any) => {
                const statusLabel = o.status === "completed" ? "Delivered" : o.status.charAt(0).toUpperCase() + o.status.slice(1);
                return `  - ${o.order_ref}: ${o.network} ${o.bundle_size} to ${o.phone_number}, ₵${Number(o.amount).toFixed(2)}, ${statusLabel} (${new Date(o.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })})`;
              }).join("\n")
            : "  (No recent orders)";

          userContext = `Signed-in user info:
- Name: ${profile?.full_name || "Customer"}
- Tier: ${tier === "agent" ? "Agent" : "General"}
- Wallet balance: ₵${Number(profile?.wallet_balance || 0).toFixed(2)}
- Referral code: ${profile?.referral_code || "N/A"}
${tier === "agent" ? `- Agent code: ${profile?.agent_code || "N/A"}` : ""}

Last 5 orders:
${ordersText}`;
        }
      } catch (e) {
        console.error("user context fetch failed:", e);
      }
    }

    const pricing = buildPricingText(userTier);
    const tierLabel = userTier === "agent" ? "Agent" : userTier === "general" ? "General" : "Guest (not signed in)";
    const nowGMT = new Date().toUTCString();

    const systemPrompt = `You are the Donmac Data Hub support assistant — friendly, warm, and concise. Speak like a real Ghanaian customer service rep. Keep answers short and natural.

CRITICAL RULES:
1. Never use markdown formatting (no asterisks *, no bold **, no headings #, no underscores _). Write plain conversational text only.
2. Always use the EXACT prices from the PRICING section below. Do NOT invent or guess prices.
3. Use ₵ for cedis. Always show two decimals (e.g. ₵15.00).
4. When the user asks about a bundle price, give ONLY the price for THEIR tier (${tierLabel}). The PRICING section below already contains only their tier's prices — never mention "general" or "agent" pricing tiers in the answer. Just say e.g. "MTN 3GB is ₵13.90." For guest users (not signed in), quote the listed price and gently mention they can sign in to see if agent rates apply.
5. If the user asks about THEIR own order, wallet, or account — use the "Signed-in user info" section below. Do not make things up.
6. If you cannot solve the issue (refunds, stuck orders older than 4 hours, account changes, complaints, agent approval), politely tell the user to contact admin via WhatsApp 0549358359 or use the Live Chat tab in this widget. Keep the handoff message warm.
7. Never mention internal systems (Supabase, edge functions, etc).

ABOUT DONMAC DATA HUB:
- We sell affordable data bundles for MTN, Telecel, AT Big Time, and AT Premium in Ghana.
- Payment options: Wallet (top up first) or Paystack (direct, 2% fee).
- Wallet top-up: Paystack online, OR send MoMo to 0549358359 (Osei Michael) and claim with the transaction ID on the Top Up page.
- Minimum top-up: ₵5 for general users, ₵20 for agents.
- Order delivery: MTN takes 3 minutes to 4 hours. Telecel and AT are usually instant.
- Off-hours rule: orders placed between 10pm and 5am GMT are queued and delivered from 5am.
- Becoming an agent: pay a one-time ₵40 MoMo fee to 0549358359 and apply on the Become an Agent page. Agents get wholesale prices and a unique agent code.
- Bundle validity: AT Big Time has no expiry. AT Premium = 60 days. MTN = 90 days. Telecel = 90 days.
- Referrals: General users earn ₵0.50 when their referral makes their first purchase. Agents earn ₵10 when their referral becomes an agent.
- Complaints: users can file a complaint about any order from the past 48 hours on the Complaints page.

CURRENT TIME (GMT): ${nowGMT}

PRICING for this user (tier: ${tierLabel}) — always use these exact figures and never quote a different tier's price:
${pricing}

${userContext}

Respond in 1-3 short sentences unless the user clearly needs a longer answer. Be human, kind, and clear.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-stream while stripping markdown from each delta on the fly
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string") {
                  parsed.choices[0].delta.content = cleanText(delta);
                }
                controller.enqueue(encoder.encode("data: " + JSON.stringify(parsed) + "\n"));
              } catch {
                controller.enqueue(encoder.encode(line + "\n"));
              }
            }
          }
          if (buf) controller.enqueue(encoder.encode(buf));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
