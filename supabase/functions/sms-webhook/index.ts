import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse MoMo SMS to extract transaction details
function parseMomoSms(smsBody: string): { transactionId: string; amount: number; network: string } | null {
  const text = smsBody.trim();

  // Try to find an 11-digit transaction ID
  const txnMatch = text.match(/\b(\d{11})\b/);
  if (!txnMatch) return null;
  const transactionId = txnMatch[1];

  // Try to extract amount - look for GHS/GHC/cedis patterns
  const amountMatch = text.match(/GH[SC]\s*([\d,]+\.?\d*)/i)
    || text.match(/([\d,]+\.?\d*)\s*(?:GH[SC]|cedis?)/i)
    || text.match(/(?:amount|received|sent|of)\s*(?:GH[SC])?\s*([\d,]+\.?\d*)/i);
  
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  // Detect network from SMS content or sender
  let network = "MTN";
  const lowerText = text.toLowerCase();
  if (lowerText.includes("telecel") || lowerText.includes("vodafone")) {
    network = "Telecel";
  } else if (lowerText.includes("airtel") || lowerText.includes("tigo") || lowerText.includes("airteltigo")) {
    network = "AirtelTigo";
  }

  return { transactionId, amount, network };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const smsBody: string = body.message || body.sms || body.body || body.text || "";

    if (!smsBody) {
      return new Response(JSON.stringify({ error: "No SMS body provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseMomoSms(smsBody);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Could not parse MoMo SMS", raw: smsBody }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check for duplicate
    const { data: existing } = await supabase
      .from("verified_topups")
      .select("id")
      .eq("transaction_id", parsed.transactionId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: "duplicate", transactionId: parsed.transactionId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("verified_topups").insert({
      transaction_id: parsed.transactionId,
      amount: parsed.amount,
      network: parsed.network,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: "created",
        transactionId: parsed.transactionId,
        amount: parsed.amount,
        network: parsed.network,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
