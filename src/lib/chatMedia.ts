import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a chat_messages.media_url value to a usable URL.
 * - If the value already looks like a full http(s) URL, return as-is (legacy public URLs).
 * - Otherwise treat it as a storage path inside the private "chat-media" bucket
 *   and return a short-lived signed URL.
 */
export async function resolveChatMediaUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(value, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
