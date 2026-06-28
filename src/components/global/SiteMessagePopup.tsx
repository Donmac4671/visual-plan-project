import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

export default function SiteMessagePopup() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkLatest = async () => {
      const { data } = await supabase
        .from("site_messages")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].message.trim()) {
        const msg = data[0];
        const dismissedKey = `site_msg_dismissed_${msg.id}_${msg.updated_at}`;
        if (!localStorage.getItem(dismissedKey)) {
          setMessage(msg.message);
          setOpen(true);
          localStorage.setItem(dismissedKey, "1");
        }
      }
    };

    checkLatest();

    const ch = supabase
      .channel(`site-messages-popup-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_messages" }, () => checkLatest())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Announcement
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-2 text-foreground text-sm">
            {message}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={() => setOpen(false)} className="w-full gradient-primary text-primary-foreground">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
