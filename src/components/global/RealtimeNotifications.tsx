import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  showNativeNotification,
  requestNotificationPermission,
  registerServiceWorker,
} from "@/lib/notifications";
import { toast } from "@/hooks/use-toast";

export default function RealtimeNotifications() {
  const { user, isAdmin, profile } = useAuth();
  const isAgent = profile?.tier === "agent";
  const isAgentRef = useRef(isAgent);
  const profilePhoneRef = useRef((profile?.phone ?? "").replace(/\D/g, ""));
  const lastNotificationRef = useRef<Record<string, number>>({});
  isAgentRef.current = isAgent;
  profilePhoneRef.current = (profile?.phone ?? "").replace(/\D/g, "");

  const normalizePhone = useCallback((value?: string | null) => (value ?? "").replace(/\D/g, ""), []);

  const shouldIncludeRecipient = useCallback((recipientPhone?: string | null) => {
    if (isAgentRef.current) return true;

    const recipient = normalizePhone(recipientPhone);
    const accountPhone = profilePhoneRef.current;

    return Boolean(recipient && accountPhone && recipient !== accountPhone);
  }, [normalizePhone]);

  const buildOrderOfMessage = useCallback((network: string, pkg: string, phone?: string | null) => {
    const includeRecipient = shouldIncludeRecipient(phone);
    return `Your ${network} order of ${pkg}${includeRecipient && phone ? ` for ${phone}` : ""}`;
  }, [shouldIncludeRecipient]);

  const buildDeliveredMessage = useCallback((network: string, pkg: string, phone?: string | null) => {
    const includeRecipient = shouldIncludeRecipient(phone);
    if (includeRecipient && phone) {
      return `Your ${network} ${pkg} for ${phone} has been delivered.`;
    }
    return `Your ${network} ${pkg} has been successfully delivered.`;
  }, [shouldIncludeRecipient]);

  useEffect(() => {
    if (!user) return;
    registerServiceWorker();
    requestNotificationPermission();
  }, [user]);

  const notify = useCallback((title: string, body: string) => {
    const key = `${title}:${body}`;
    const now = Date.now();
    const lastShown = lastNotificationRef.current[key] ?? 0;

    if (now - lastShown < 4000) return;

    lastNotificationRef.current[key] = now;

    Object.entries(lastNotificationRef.current).forEach(([entryKey, timestamp]) => {
      if (now - timestamp > 15000) delete lastNotificationRef.current[entryKey];
    });

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      toast({ title, description: body });
      return;
    }

    showNativeNotification(title, body);
  }, []);

  useEffect(() => {
    if (!user || isAdmin) return;

    const chInsert = supabase
      .channel(`orders-insert-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const o = payload.new as any;
        const net = o.network ?? "";
        const pkg = o.bundle_size ?? "";
        const phone = o.phone_number ?? "";
        const status = o.status;
        if (status === "processing") {
          notify("Order Placed", `${buildOrderOfMessage(net, pkg, phone)} has been successfully placed and is being processed.`);
        } else if (status === "pending") {
          notify("Order Pending", `${buildOrderOfMessage(net, pkg, phone)} is pending. It will be processed soon.`);
        }
      })
      .subscribe();

    const chUpdate = supabase
      .channel(`orders-update-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const oldStatus = (payload.old as any)?.status;
        const newStatus = (payload.new as any)?.status;
        if (!newStatus || oldStatus === newStatus) return;
        const net = (payload.new as any)?.network ?? "";
        const pkg = (payload.new as any)?.bundle_size ?? "";
        const phone = (payload.new as any)?.phone_number ?? "";

        if (newStatus === "completed") {
          notify("Order Delivered", buildDeliveredMessage(net, pkg, phone));
        } else if (newStatus === "failed") {
          notify("Order Failed", `${buildOrderOfMessage(net, pkg, phone)} has failed. Please contact support.`);
        } else if (newStatus === "pending") {
          notify("Order Pending", `${buildOrderOfMessage(net, pkg, phone)} is pending. It will be processed soon.`);
        } else if (newStatus === "processing") {
          notify("Order Processing", `${buildOrderOfMessage(net, pkg, phone)} is now being processed.`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chInsert);
      supabase.removeChannel(chUpdate);
    };
  }, [user, isAdmin, notify, buildOrderOfMessage, buildDeliveredMessage]);

  // ── User: top-up updates ──
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`topups-notifications-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallet_topups", filter: `user_id=eq.${user.id}` }, (payload) => {
        const oldStatus = (payload.old as any)?.status;
        const newStatus = (payload.new as any)?.status;
        const amount = (payload.new as any)?.amount;
        if (newStatus && oldStatus !== newStatus) {
          notify("Top-up Update",
            newStatus === "completed"
              ? `Your top-up${amount ? ` of ₵${Number(amount).toFixed(2)}` : ""} is completed.`
              : `Your top-up status is now ${newStatus}.`
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, notify]);

  // ── Admin: new orders & MoMo top-ups ──
  useEffect(() => {
    if (!user || !isAdmin) return;
    const ch1 = supabase
      .channel("admin-new-orders-notification")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as any;
        if (o.user_id === user.id) return;
        notify("🔔 New Order Received!", `${o.order_ref}: ${o.network} ${o.bundle_size} to ${o.phone_number} — ₵${Number(o.amount ?? 0).toFixed(2)}`);
      })
      .subscribe();
    const ch2 = supabase
      .channel("admin-new-topups-notification")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_topups" }, (payload) => {
        const t = payload.new as any;
        if (t.user_id === user.id || t.method !== "momo") return;
        notify("💰 New MoMo Top-up Request!", `A user submitted a MoMo deposit of ₵${Number(t.amount ?? 0).toFixed(2)} for approval.`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user, isAdmin, notify]);

  // ── Chat message notifications ──
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }) }, (payload) => {
        const msg = payload.new as any;
        if (isAdmin && msg.sender_role === "admin") return;
        if (!isAdmin && msg.sender_role === "user") return;
        const preview = (msg.message ?? "").slice(0, 60) + ((msg.message ?? "").length > 60 ? "…" : "");
        notify(
          isAdmin ? "💬 New Chat Message" : "💬 New Reply",
          isAdmin ? `A user sent: "${preview}"` : `Support replied: "${preview}"`
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin, notify]);

  // ── Complaint notifications ──
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`complaints-notifications-${user.id}`)
      .on("postgres_changes", { event: isAdmin ? "INSERT" : "UPDATE", schema: "public", table: "complaints", ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }) }, (payload) => {
        if (isAdmin) {
          const c = payload.new as any;
          if (c.user_id === user.id) return;
          notify("📋 New Complaint", `Subject: ${(c.subject ?? "").slice(0, 80)}`);
        } else {
          const oldReply = (payload.old as any)?.admin_reply;
          const newReply = (payload.new as any)?.admin_reply;
          if (newReply && newReply !== oldReply) {
            notify("📋 Complaint Reply", `Admin replied: "${newReply.slice(0, 60)}${newReply.length > 60 ? "…" : ""}"`);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin, notify]);

  return null;
}
