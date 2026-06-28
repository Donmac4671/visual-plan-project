import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";

interface BannerMsg {
  id: string;
  message: string;
  updated_at: string;
}

export default function SiteMessageBanner() {
  const [banner, setBanner] = useState<BannerMsg | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fetchBanner = async () => {
      const { data } = await supabase
        .from("site_messages")
        .select("id, message, updated_at, show_as_banner, is_active")
        .eq("show_as_banner", true)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].message.trim()) {
        const msg = data[0];
        const dismissedKey = `site_banner_dismissed_${msg.id}_${msg.updated_at}`;
        if (!localStorage.getItem(dismissedKey)) {
          setBanner({ id: msg.id, message: msg.message, updated_at: msg.updated_at });
          setHidden(false);
        }
      } else {
        setBanner(null);
      }
    };
    fetchBanner();

    const ch = supabase
      .channel(`site-messages-banner-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_messages" }, () => fetchBanner())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const dismiss = () => {
    if (banner) {
      localStorage.setItem(
        `site_banner_dismissed_${banner.id}_${banner.updated_at}`,
        "1",
      );
    }
    setHidden(true);
  };

  if (!banner || hidden) return null;

  return (
    <div className="w-full gradient-primary text-primary-foreground px-4 py-2 flex items-start gap-3 shadow-md relative z-40 rounded-xl">
      <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="flex-1 text-sm whitespace-pre-wrap leading-snug">{banner.message}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
