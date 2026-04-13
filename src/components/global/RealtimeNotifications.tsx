import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { showNativeNotification, requestNotificationPermission } from "@/lib/notifications";

export default function RealtimeNotifications() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Request permission on mount
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  const notify = useCallback((title: string, description: string) => {
    showNativeNotification(title, description);
    toast({ title, description });
  }, [toast]);

  // User order status updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`orders-notifications-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        const oldStatus = (payload.old as any)?.status;
        const newStatus = (payload.new as any)?.status;
        const orderRef = (payload.new as any)?.order_ref ?? "your order";
        if (newStatus && oldStatus !== newStatus) {
          const displayStatus = newStatus === "completed" ? "delivered" : newStatus;
          notify("Order status updated", `${orderRef} is now ${displayStatus}`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, notify]);

  // User top-up updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`topups-notifications-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallet_topups", filter: `user_id=eq.${user.id}` }, (payload) => {
        const oldStatus = (payload.old as any)?.status;
        const newStatus = (payload.new as any)?.status;
        const amount = (payload.new as any)?.amount;
        if (newStatus && oldStatus !== newStatus) {
          notify("Top-up update",
            newStatus === "completed"
              ? `Your top-up${amount ? ` of ₵${Number(amount).toFixed(2)}` : ""} is completed.`
              : `Your top-up status is now ${newStatus}.`
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, notify]);

  // Admin: new orders & MoMo top-ups
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

  // Chat message notifications
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

  // Complaint notifications
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
