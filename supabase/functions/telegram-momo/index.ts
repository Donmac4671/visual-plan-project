import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

// Parse MoMo SMS to extract transaction details
function parseMomoSms(smsBody: string): { transactionId: string; amount: number; network: string } | null {
  let text = smsBody.trim();

  // Strip SMS forwarder header — match 4+ asterisks as separator
  const separatorMatch = text.match(/\*{4,}/);
  if (separatorMatch) {
    text = text.substring(separatorMatch.index! + separatorMatch[0].length).trim();
  }

  // Try to find transaction ID - prefer labeled patterns first
  const txnMatch = text.match(/(?:Financial Transaction Id|Transaction Id|External Transaction Id)[:\s]*(\d{11})/i)
    || text.match(/\b(\d{11})\b/);
  if (!txnMatch) return null;
  const transactionId = txnMatch[1];

  // Try to extract amount - look for GHS/GHC/cedis patterns
  const amountMatch = text.match(/GH[SC]\s*([\d,]+\.?\d*)/i)
    || text.match(/([\d,]+\.?\d*)\s*(?:GH[SC]|cedis?)/i)
    || text.match(/(?:amount|received|sent|of)\s*(?:GH[SC])?\s*([\d,]+\.?\d*)/i);

  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  // Detect network from SMS content
  let network = "MTN";
  const lowerText = text.toLowerCase();
  if (lowerText.includes("telecel") || lowerText.includes("vodafone")) {
    network = "Telecel";
  } else if (lowerText.includes("airtel") || lowerText.includes("tigo") || lowerText.includes("airteltigo")) {
    network = "AirtelTigo";
  }

  return { transactionId, amount, network };
}

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), { status: 500 });
  }

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY is not configured" }), { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;
  let totalTopups = 0;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  // Poll continuously until time runs out
  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    console.log(`Polling getUpdates: offset=${currentOffset}, timeout=${timeout}`);
    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("getUpdates failed:", response.status, JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    console.log(`getUpdates returned ${updates.length} updates`);
    if (updates.length === 0) continue;

    for (const update of updates) {
      const msg = update.message;
      if (!msg?.text) {
        console.log("Skipping update (no text):", update.update_id, JSON.stringify(msg?.forward_origin ?? msg?.forward_from ?? "no-forward-info"));
        continue;
      }

      const chatId = msg.chat.id;
      const text = msg.text;

      console.log(`Processing msg from chat ${chatId}, length=${text.length}, isForward=${!!msg.forward_origin || !!msg.forward_from}`);

      // Try to parse as MoMo SMS
      const parsed = parseMomoSms(text);

      if (parsed) {
        // Check for duplicate
        const { data: existing } = await supabase
          .from("verified_topups")
          .select("id")
          .eq("transaction_id", parsed.transactionId)
          .maybeSingle();

        if (existing) {
          // Send duplicate reply
          await sendTelegramMessage(
            LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
            `⚠️ Duplicate: Transaction ${parsed.transactionId} already exists.`
          );
        } else {
          // Insert into verified_topups
          const { error: insertErr } = await supabase.from("verified_topups").insert({
            transaction_id: parsed.transactionId,
            amount: parsed.amount,
            network: parsed.network,
          });

          if (insertErr) {
            await sendTelegramMessage(
              LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
              `❌ Error saving: ${insertErr.message}`
            );
          } else {
            totalTopups++;
            await sendTelegramMessage(
              LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
              `✅ Verified Top-up Added!\n\n💰 Amount: GHS ${parsed.amount}\n📱 Network: ${parsed.network}\n🔢 Transaction ID: ${parsed.transactionId}`
            );
          }
        }
      } else {
        // Not a MoMo SMS - send help message
        await sendTelegramMessage(
          LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
          `📲 Forward your MoMo payment SMS here and I'll automatically capture the transaction for your customers to claim.`
        );
      }

      totalProcessed++;
    }

    // Log messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
        processed: true,
      }));

    if (rows.length > 0) {
      await supabase.from("telegram_messages").upsert(rows, { onConflict: "update_id" });
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, topups: totalTopups, finalOffset: currentOffset }));
});

async function sendTelegramMessage(lovableKey: string, telegramKey: string, chatId: number, text: string) {
  try {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    await res.text(); // consume body
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
  }
}
