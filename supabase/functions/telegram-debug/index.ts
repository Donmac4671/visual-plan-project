const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async () => {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;

  // Get bot info
  const meRes = await fetch(`${GATEWAY_URL}/getMe`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
  });
  const me = await meRes.json();

  // Get webhook info
  const whRes = await fetch(`${GATEWAY_URL}/getWebhookInfo`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
  });
  const wh = await whRes.json();

  // Try getUpdates with offset 0 to see any pending
  const updRes = await fetch(`${GATEWAY_URL}/getUpdates`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ offset: 877086791, timeout: 2 }),
  });
  const upd = await updRes.json();

  return new Response(JSON.stringify({ botInfo: me, webhookInfo: wh, updates: upd }, null, 2));
});
