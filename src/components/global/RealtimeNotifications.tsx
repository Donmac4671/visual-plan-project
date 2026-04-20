import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  playNotificationSound,
} from "@/lib/notifications";
import { toast } from "@/hooks/use-toast";

/**
 * Subscribes the browser to Web Push (background notifications come from the
 * SW via the notifications-dispatcher edge function) and shows in-app toasts
 * when the tab is visible.
 */
export default function RealtimeNotifications() {
  const { user, isAdmin, profile } = useAuth();
  const lastToastRef = useRef<Record<string, number>>({});

  // Register SW + subscribe to push once on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      await registerServiceWorker();
      await requestNotificationPermission();
      await subscribeToPush(user.id);
    })();
  }, [user]);

  const showToast = (title: string, body: string) => {
    const key = `${title}:${body}`;
    const now = Date.now();
    const last = lastToastRef.current[key] ?? 0;
    if (now - last < 4000) return;
    lastToastRef.current[key] = now;

    // Cleanup old entries
    Object.entries(lastToastRef.current).forEach(([k, t]) => {
      if (now - t > 15000) delete lastToastRef.current[k];
    });

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      toast({ title, description: body });
      playNotificationSound();
    }
    // When hidden, the SW push event from the server takes care of native notification.
  };

  // Listen for play-sound messages from the SW (sent on every push)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "play-sound") playNotificationSound();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // Build wording matching the agreed structure
  const phoneOwner = (profile?.phone ?? "").replace(/\D/g, "");
  const isAgent = profile?.tier === "agent";
  const includeRecipient = (recipient?: string | null) => {
    const r = (recipient ?? "").replace(/\D/g, "");
    if (isAgent) return Boolean(r);
    return Boolean(r && phoneOwner && r !== phoneOwner);
  };

  // ── User: own orders (in-app toasts only) ──
  useEffect(() => {
    if (!user || isAdmin) return;

    const onInsert = (payload: any) => {
      const o = payload.new;
      const net = o.network ?? "";
      const pkg = o.bundle_size ?? "";
      const phone = o.phone_number ?? "";
      const tail = includeRecipient(phone) ? ` for ${phone}` : "";
      if (o.status === "processing") {
        showToast("Order Placed", `Your ${net} order of ${pkg}${tail} has been successfully placed and is being processed.`);
      } else if (o.status === "pending") {
        showToast("Order Pending", `Your ${net} order of ${pkg}${tail} is pending and will be processed soon.`);
      }
    };

    const onUpdate = (payload: any) => {
      const oldS = payload.old?.status;
      const newS = payload.new?.status;
      if (!newS || oldS === newS) return;
      const net = payload.new.network ?? "";
      const pkg = payload.new.bundle_size ?? "";
      const phone = payload.new.phone_number ?? "";
      const tail = includeRecipient(phone) ? ` for ${phone}` : "";

      if (newS === "completed") {
        showToast("Order Delivered", `Your ${net} ${pkg}${tail} has been successfully delivered.`);
      } else if (newS === "failed") {
        showToast("Order Failed", `Your ${net} order of ${pkg}${tail} failed. Please contact support.`);
      } else if (newS === "pending") {
        showToast("Order Pending", `Your ${net} order of ${pkg}${tail} is pending and will be processed soon.`);
      } else if (newS === "processing") {
        showToast("Order Processing", `Your ${net} order of ${pkg}${tail} is now being processed.`);
      }
    };

    const ch = supabase
      .channel(`orders-self-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, onUpdate)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin, profile?.phone, profile?.tier]);

  // ── User: top-ups ──
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`topups-self-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallet_topups", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        const oldS = payload.old?.status;
        const newS = payload.new?.status;
        const amount = payload.new?.amount;
        if (newS && oldS !== newS) {
          showToast(
            "Top-up Update",
            newS === "completed"
              ? `Your top-up${amount ? ` of ₵${Number(amount).toFixed(2)}` : ""} is completed.`
              : `Your top-up status is now ${newS}.`
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ── Admin: live in-app toasts for everything (push handled server-side) ──
  useEffect(() => {
    if (!user || !isAdmin) return;

    const ch1 = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        const o = payload.new;
        if (o.user_id === user.id) return;
        showToast("🔔 New Order", `${o.order_ref}: ${o.network} ${o.bundle_size} → ${o.phone_number} (₵${Number(o.amount ?? 0).toFixed(2)})`);
      })
      .subscribe();

    const ch2 = supabase
      .channel("admin-topups-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_topups" }, (payload: any) => {
        const t = payload.new;
        if (t.user_id === user.id) return;
        showToast("💰 New Top-up", `${t.method?.toUpperCase()} deposit of ₵${Number(t.amount ?? 0).toFixed(2)}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user, isAdmin]);

  // ── Chat / complaints in-app toasts ──
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-self-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }) },
        (payload: any) => {
          const msg = payload.new;
          if (isAdmin && msg.sender_role === "admin") return;
          if (!isAdmin && msg.sender_role === "user") return;
          const preview = (msg.message ?? "").slice(0, 60) + ((msg.message ?? "").length > 60 ? "…" : "");
          showToast(
            isAdmin ? "💬 New Chat Message" : "💬 New Reply",
            isAdmin ? `A user sent: "${preview}"` : `Support replied: "${preview}"`
          );
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin]);

  return null;
}
