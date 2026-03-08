import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function RealtimeNotifications() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const ordersChannel = supabase
      .channel(`orders-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string; order_ref?: string } | null)?.status;
          const orderRef = (payload.new as { order_ref?: string } | null)?.order_ref ?? "your order";

          if (newStatus && oldStatus !== newStatus) {
            const displayStatus = newStatus === "completed" ? "delivered" : newStatus;
            toast({
              title: "Order status updated",
              description: `${orderRef} is now ${displayStatus}`,
            });
          }
        }
      )
      .subscribe();

    const topupsChannel = supabase
      .channel(`topups-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallet_topups",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string; amount?: number } | null)?.status;
          const amount = (payload.new as { amount?: number } | null)?.amount;

          if (newStatus && oldStatus !== newStatus) {
            toast({
              title: "Top-up update",
              description:
                newStatus === "completed"
                  ? `Your top-up${amount ? ` of ₵${Number(amount).toFixed(2)}` : ""} is completed.`
                  : `Your top-up status is now ${newStatus}.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(topupsChannel);
    };
  }, [user, toast]);

  // Admin: get notified on every new order from any user
  useEffect(() => {
    if (!user || !isAdmin) return;

    const adminOrdersChannel = supabase
      .channel("admin-new-orders-notification")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const order = payload.new as {
            order_ref?: string;
            network?: string;
            bundle_size?: string;
            phone_number?: string;
            amount?: number;
            user_id?: string;
          };

          // Don't notify for own orders
          if (order.user_id === user.id) return;

          toast({
            title: "🔔 New Order Received!",
            description: `${order.order_ref}: ${order.network} ${order.bundle_size} to ${order.phone_number} — ₵${Number(order.amount ?? 0).toFixed(2)}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(adminOrdersChannel);
    };
  }, [user, isAdmin, toast]);

  return null;
}
