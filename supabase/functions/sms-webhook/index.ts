import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const SMS_TEXT_KEYS = ["message", "sms", "body", "text", "msg", "messageText", "content", "payload"];

type ParsedMomoSms = {
  transactionId: string;
  amount: number;
  network: string;
};

type ExtractionResult = {
  smsBody: string;
  source: string;
  payloadKeys: string[];
};

function parseMomoSms(smsBody: string): ParsedMomoSms | null {
  let text = smsBody.trim();

  const separatorMatch = text.match(/\*{4,}/);
  if (separatorMatch) {
    text = text.substring(separatorMatch.index! + separatorMatch[0].length).trim();
  }

  const txnMatch = text.match(/(?:Financial Transaction Id|Transaction Id|External Transaction Id|Trans(?:action)? ID|Txn ID)[:\s#-]*(\d{11})/i)
    || text.match(/\b(\d{11})\b/);
  if (!txnMatch) return null;
  const transactionId = txnMatch[1];

  const amountMatch = text.match(/(?:GH[SC]|GH¢|¢)\s*([\d,]+\.?\d*)/i)
    || text.match(/([\d,]+\.?\d*)\s*(?:GH[SC]|GH¢|¢|cedis?)/i)
    || text.match(/(?:amount|received|sent|of)\s*(?:GH[SC]|GH¢|¢)?\s*([\d,]+\.?\d*)/i);

  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  let network = "MTN";
  const lowerText = text.toLowerCase();
  if (lowerText.includes("telecel") || lowerText.includes("vodafone")) {
    network = "Telecel";
  } else if (lowerText.includes("airtel") || lowerText.includes("tigo") || lowerText.includes("airteltigo")) {
    network = "AirtelTigo";
  }

  return { transactionId, amount, network };
}

function firstStringValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const nestedKeys = ["data", "payload", "message"];
  for (const nestedKey of nestedKeys) {
    const nestedValue = record[nestedKey];
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const nestedText = firstStringValue(nestedValue as Record<string, unknown>, keys);
      if (nestedText) return nestedText;
    }
  }

  return "";
}

function getQuerySmsText(url: URL): string {
  for (const key of SMS_TEXT_KEYS) {
    const value = url.searchParams.get(key);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function extractSmsBody(req: Request): Promise<ExtractionResult> {
  const url = new URL(req.url);
  const queryKeys = Array.from(url.searchParams.keys());
  const queryText = getQuerySmsText(url);

  if (queryText) {
    return { smsBody: queryText, source: "query", payloadKeys: queryKeys };
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return { smsBody: "", source: "query", payloadKeys: queryKeys };
  }

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const formValues: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        formValues[key] = value;
      }
    }

    return {
      smsBody: firstStringValue(formValues, SMS_TEXT_KEYS),
      source: "multipart",
      payloadKeys: Object.keys(formValues),
    };
  }

  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return { smsBody: "", source: contentType || "empty", payloadKeys: queryKeys };
  }

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as unknown;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const record = body as Record<string, unknown>;
        const smsBody = firstStringValue(record, SMS_TEXT_KEYS);
        if (smsBody) {
          return { smsBody, source: "json", payloadKeys: Object.keys(record) };
        }
      }
    } catch (error) {
      console.error("Failed to parse JSON body:", error);
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(rawBody);
    const formValues: Record<string, unknown> = {};

    for (const [key, value] of form.entries()) {
      formValues[key] = value;
    }

    const smsBody = firstStringValue(formValues, SMS_TEXT_KEYS);
    if (smsBody) {
      return {
        smsBody,
        source: "form-urlencoded",
        payloadKeys: Array.from(form.keys()),
      };
    }
  }

  return {
    smsBody: rawBody.trim(),
    source: contentType || "raw-text",
    payloadKeys: queryKeys,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`sms-webhook invoked: method=${req.method}, contentType=${req.headers.get("content-type") ?? "none"}`);

  try {
    const { smsBody, source, payloadKeys } = await extractSmsBody(req);
    console.log(`sms-webhook extracted source=${source}, keys=${payloadKeys.join(",") || "none"}, preview=${smsBody.slice(0, 160)}`);

    if (!smsBody) {
      return new Response(JSON.stringify({
        error: "No SMS body provided",
        supported: [
          "Query params: message, sms, body, text",
          "JSON body",
          "Form-urlencoded body",
          "Raw text body",
        ],
      }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const parsed = parseMomoSms(smsBody);
    if (!parsed) {
      console.error("Could not parse MoMo SMS:", smsBody);
      return new Response(JSON.stringify({ error: "Could not parse MoMo SMS", raw: smsBody, source }), {
        status: 422,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await supabase
      .from("verified_topups")
      .select("id")
      .eq("transaction_id", parsed.transactionId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        status: "duplicate",
        transactionId: parsed.transactionId,
        amount: parsed.amount,
        network: parsed.network,
        source,
      }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const { error } = await supabase.from("verified_topups").insert({
      transaction_id: parsed.transactionId,
      amount: parsed.amount,
      network: parsed.network,
    });

    if (error) {
      console.error("Failed to insert verified topup:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({
      status: "created",
      transactionId: parsed.transactionId,
      amount: parsed.amount,
      network: parsed.network,
      source,
    }), {
      status: 201,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sms-webhook failed:", err);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
