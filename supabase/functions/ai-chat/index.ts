import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are the Donmac Data Hub AI assistant — a friendly, helpful customer service agent for a Ghanaian data bundle reselling platform. 

Key information about Donmac Data Hub:
- We sell affordable internet data bundles for MTN, AirtelTigo, and Telecel (formerly Vodafone) networks in Ghana
- Users can pay via mobile wallet (loaded via MoMo or Paystack) or directly with Paystack
- Wallet top-up methods: Mobile Money (MoMo) deposits and Paystack online payment
- For MoMo deposits: users send money to our MoMo number, then claim it using the transaction ID
- Orders are processed automatically during business hours (5 AM - 10 PM GMT). Orders placed outside these hours are queued as "pending" and processed when business hours resume
- Users can become Agents to get discounted prices. Apply via the "Become an Agent" page
- Agents get special wholesale pricing on all bundles
- Users can file complaints if they have issues with orders
- Each user has a referral code to invite friends and earn rewards
- General users get ₵0.50 for each referred user's first purchase; agents get ₵10 when their referral becomes an agent

How to help:
- Answer questions about buying data, topping up wallets, order statuses, becoming an agent, filing complaints
- Be warm, conversational, and use simple English
- If you don't know something specific (like a user's order status), suggest they check the relevant page or contact support via live chat
- Keep responses concise but helpful
- Use cedis (₵) for currency references`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
