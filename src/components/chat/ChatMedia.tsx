import { useEffect, useState } from "react";
import { resolveChatMediaUrl } from "@/lib/chatMedia";

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

interface Props {
  value: string;
}

/**
 * Renders a chat_messages.media_url value. Handles both legacy public URLs and
 * new private storage paths (resolved to short-lived signed URLs).
 */
export default function ChatMedia({ value }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveChatMediaUrl(value).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value]);

  if (!url) return null;
  if (isImageUrl(value)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="media" className="rounded-lg max-w-full max-h-40 mb-1 cursor-pointer" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-xs block mb-1">
      📎 View attachment
    </a>
  );
}
