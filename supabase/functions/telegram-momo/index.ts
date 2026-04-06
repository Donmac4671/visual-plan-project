import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

function normalizeSmsText(smsBody: string): string {
  let text = smsBody.replace(/\u00a0/g, " ").trim();

  const separatorMatch = text.match(/\*{4,}/);
  if (separatorMatch) {
    text = text.substring(separatorMatch.index! + separatorMatch[0].length).trim();
  }

  text = text.replace(/\n+\s*Reply:\s*https?:\/\/\S+\s*$/i, "").trim();

  return text;
}

function detectNetwork(smsBody: string): string {
  const text = smsBody
    .replace(
      /Reference:.*?(?=(?:Financial Transaction Id|Transaction Id|External Transaction Id|Trans(?:action)? ID|Txn ID|$))/is,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (
    /\bto\s+mtn(?:\s+(?:airtime|momo|mobile money))?\b/i.test(text)
    || /\bmtn\s+(?:airtime|momo|mobile money)\b/i.test(text)
    || /^mtn\b/i.test(text)
  ) {
    return "MTN";
  }

  if (
    /\bto\s+(?:telecel|vodafone)(?:\s+(?:cash|airtime|momo|mobile money))?\b/i.test(text)
    || /\b(?:telecel|vodafone)\s+(?:cash|airtime|momo|mobile money)\b/i.test(text)
    || /^(?:telecel|vodafone)\b/i.test(text)
  ) {
    return "Telecel";
  }

  if (
    /\bto\s+(?:airteltigo|airtel|tigo)(?:\s+(?:cash|airtime|money))?\b/i.test(text)
    || /\b(?:airteltigo|airtel|tigo)\s+(?:cash|airtime|money)\b/i.test(text)
    || /^(?:airteltigo|airtel|tigo)\b/i.test(text)
  ) {
    return "AirtelTigo";
  }

  return "MTN";
}

// Parse MoMo SMS to extract transaction details
function parseMomoSms(smsBody: string): { transactionId: string; amount: number; network: string } | null {
  const text = normalizeSmsText(smsBody);

  const txnMatch = text.match(/(?:Financial Transaction Id|Transaction Id|External Transaction Id|Trans(?:action)? ID|Txn ID)[:\s#-]*(\d{11})/i)
    || text.match(/\b(\d{11})\b/);
  if (!txnMatch) return null;
  const transactionId = txnMatch[1];

  const amountMatch = text.match(/(?:GH[SC]|GH¢|¢)\s*([\d,]+\.?\d*)/i)
    || text.match(/([\d,]+\.?\d*)\s*(?:GH[SC]|GH¢|¢|cedis?)/i)
    || text.match(/(?:amount|received|sent|payment(?: received)?(?: for)?|cash in received|of)\s*(?:GH[SC]|GH¢|¢)?\s*([\d,]+\.?\d*)/i);

  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  const network = detectNetwork(text);

  return { transactionId, amount, network };
}

// Parse order command like "0241234567 MTN 1GB" or "0549358359 at premium 5gb"
const NETWORK_ALIASES: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  vodafone: "telecel",
  "at bigtime": "at-bigtime",
  "at big time": "at-bigtime",
  "at-bigtime": "at-bigtime",
  "airteltigo bigtime": "at-bigtime",
  "airteltigo big time": "at-bigtime",
  "at premium": "at-premium",
  "at-premium": "at-premium",
  "airteltigo premium": "at-premium",
  "airteltigo": "at-bigtime",
};

const GH_API_BASE = "https://ghdataconnect.com/api";

const FULFILL_NETWORK_MAP: Record<string, { key: string; endpoint: string; capacityInMB?: boolean }> = {
  mtn: { key: "mtn", endpoint: "/v1/purchaseBundle" },
  telecel: { key: "telecel", endpoint: "/v1/purchaseBundle" },
  "at-bigtime": { key: "atbigtime", endpoint: "/v1/purchaseBundle" },
  "at-premium": { key: "atishare", endpoint: "/v1/createIshareBundleOrder", capacityInMB: true },
};

function parseOrderCommand(text: string): { phone: string; networkId: string; networkDisplay: string; sizeGB: number; sizeLabel: string } | null {
  // Match: phone network size (e.g., "0241234567 MTN 1GB" or "0549358359 at premium 5gb")
  const match = text.trim().match(/^(0\d{9})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*gb$/i);
  if (!match) return null;

  const phone = match[1];
  const rawNetwork = match[2].trim().toLowerCase();
  const sizeGB = parseFloat(match[3]);

  const networkId = NETWORK_ALIASES[rawNetwork];
  if (!networkId) return null;

  const displayNames: Record<string, string> = {
    mtn: "MTN", telecel: "TELECEL", "at-bigtime": "AT BIG TIME", "at-premium": "AT PREMIUM",
  };

  return { phone, networkId, networkDisplay: displayNames[networkId] || networkId, sizeGB, sizeLabel: `${sizeGB}GB` };
}

Deno.serve(async () => {
  console.log("telegram-momo invoked");
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), { status: 500 });
  }

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY is not configured" }), { status: 500 });
  }

  // Ensure no webhook is set (webhooks prevent getUpdates from working)
  const delWebhook = await fetch(`${GATEWAY_URL}/deleteWebhook`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
  const webhookResult = await delWebhook.json();
  console.log("deleteWebhook result:", JSON.stringify(webhookResult));

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
      const text = msg?.text ?? msg?.caption ?? "";

      if (!text) {
        console.log("Skipping update (no text):", update.update_id, JSON.stringify(msg?.forward_origin ?? msg?.forward_from ?? "no-forward-info"));
        continue;
      }

      const chatId = msg.chat.id;

      console.log(`Processing msg from chat ${chatId}, length=${text.length}, hasText=${!!msg.text}, hasCaption=${!!msg.caption}, isForward=${!!msg.forward_origin || !!msg.forward_from}`);

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
        // Try to parse as an order command
        const orderCmd = parseOrderCommand(text);
        if (orderCmd) {
          await handleOrderCommand(supabase, LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId, orderCmd);
        } else {
          // Not a MoMo SMS or order - send help message
          await sendTelegramMessage(
            LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId,
            `📲 Forward your MoMo payment SMS here to auto-capture transactions.\n\n📦 To place an order, send:\n<code>0241234567 MTN 1GB</code>\n\nSupported networks: MTN, Telecel, AT BigTime, AT Premium`
          );
        }
      }

      totalProcessed++;
    }

    // Log messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? u.message.caption ?? null,
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

async function handleOrderCommand(
  supabase: any,
  lovableKey: string,
  telegramKey: string,
  chatId: number,
  order: { phone: string; networkId: string; networkDisplay: string; sizeGB: number; sizeLabel: string }
) {
  const GH_API_KEY = Deno.env.get("GHDATACONNECT_API_KEY");
  if (!GH_API_KEY) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ GHDataConnect API key not configured.`);
    return;
  }

  // Find admin user to debit wallet
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (!adminRole) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ No admin account found.`);
    return;
  }

  const adminUserId = adminRole.user_id;

  // Look up bundle price from custom_bundles first, then fall back to 0 (admin order)
  const { data: customBundle } = await supabase
    .from("custom_bundles")
    .select("agent_price")
    .eq("network_id", order.networkId)
    .eq("size_gb", order.sizeGB)
    .maybeSingle();

  const amount = customBundle?.agent_price ?? 0;

  // Create order record
  const { data: orderCount } = await supabase.from("orders").select("id", { count: "exact", head: true });
  const orderRef = `DMH${String((orderCount?.length ?? 0) + 1).padStart(3, "0")}`;
  const reference = `DMH${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const { data: newOrder, error: orderErr } = await supabase.from("orders").insert({
    user_id: adminUserId,
    order_ref: orderRef,
    network: order.networkDisplay,
    phone_number: order.phone,
    bundle_size: order.sizeLabel,
    amount,
    status: "processing",
    payment_method: "wallet",
  }).select("id").single();

  if (orderErr) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Failed to create order: ${orderErr.message}`);
    return;
  }

  // Call GHDataConnect directly
  const networkConfig = FULFILL_NETWORK_MAP[order.networkId];
  if (!networkConfig) {
    await sendTelegramMessage(lovableKey, telegramKey, chatId, `❌ Unknown network config for ${order.networkId}`);
    return;
  }

  const capacity = networkConfig.capacityInMB ? order.sizeGB * 1000 : order.sizeGB;
  let requestBody: Record<string, unknown>;
  if (networkConfig.endpoint === "/v1/createIshareBundleOrder") {
    requestBody = { reference, msisdn: order.phone, capacity };
  } else {
    requestBody = { network: networkConfig.key, reference, msisdn: order.phone, capacity };
  }

  console.log(`Telegram order: ${order.networkDisplay} ${order.sizeLabel} to ${order.phone}`);

  try {
    const response = await fetch(`${GH_API_BASE}${networkConfig.endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log(`GHDataConnect Telegram order response:`, JSON.stringify(result));

    if (result.success) {
      await supabase.from("orders").update({ gh_reference: reference }).eq("id", newOrder.id);

      // Debit admin wallet
      if (amount > 0) {
        await supabase.from("profiles").update({ wallet_balance: supabase.rpc ? undefined : 0 }).eq("user_id", adminUserId);
        // Use raw SQL-like approach: decrement wallet
        const { data: profile } = await supabase.from("profiles").select("wallet_balance").eq("user_id", adminUserId).single();
        if (profile) {
          await supabase.from("profiles").update({ wallet_balance: profile.wallet_balance - amount }).eq("user_id", adminUserId);
        }
      }

      await sendTelegramMessage(lovableKey, telegramKey, chatId,
        `✅ Order Placed!\n\n📱 ${order.networkDisplay} ${order.sizeLabel}\n📞 ${order.phone}\n💰 GHS ${amount}\n🔖 Ref: ${orderRef}\n📋 GH Ref: ${reference}`
      );
    } else {
      await supabase.from("orders").update({ status: "failed" }).eq("id", newOrder.id);
      await sendTelegramMessage(lovableKey, telegramKey, chatId,
        `❌ Order Failed!\n\n📱 ${order.networkDisplay} ${order.sizeLabel}\n📞 ${order.phone}\n⚠️ ${result.message || "Provider error"}`
      );
    }
  } catch (err) {
    await supabase.from("orders").update({ status: "failed" }).eq("id", newOrder.id);
    await sendTelegramMessage(lovableKey, telegramKey, chatId,
      `❌ Order Error: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
