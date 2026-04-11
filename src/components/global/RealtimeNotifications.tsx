import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Use an Audio element with a data URI for maximum compatibility
const NOTIFICATION_SOUND_B64 = (() => {
  // Generate a short WAV notification sound programmatically
  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const freq1 = 880;
    const freq2 = 1320;
    const sample = envelope * (
      0.5 * Math.sin(2 * Math.PI * freq1 * t) +
      0.3 * Math.sin(2 * Math.PI * freq2 * t)
    );
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
})();

function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_B64);
    audio.volume = 1.0;
    audio.play().catch(() => {
      // Autoplay blocked – nothing we can do without user gesture
    });
  } catch {
    // Audio not supported
  }
}

function vibrate() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  } catch {
    // Vibration not supported
  }
}

export default function RealtimeNotifications() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const adminAlert = useCallback(() => {
    playNotificationSound();
    vibrate();
  }, []);

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
            playNotificationSound();
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
            playNotificationSound();
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

  // Admin: get notified on every new order and MoMo top-up from any user
  useEffect(() => {
    if (!user || !isAdmin) return;

    const adminOrdersChannel = supabase
      .channel("admin-new-orders-notification")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as {
            order_ref?: string; network?: string; bundle_size?: string;
            phone_number?: string; amount?: number; user_id?: string;
          };
          if (order.user_id === user.id) return;
          adminAlert();
          toast({
            title: "🔔 New Order Received!",
            description: `${order.order_ref}: ${order.network} ${order.bundle_size} to ${order.phone_number} — ₵${Number(order.amount ?? 0).toFixed(2)}`,
          });
        }
      )
      .subscribe();

    const adminTopupsChannel = supabase
      .channel("admin-new-topups-notification")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_topups" },
        (payload) => {
          const topup = payload.new as {
            amount?: number; method?: string; user_id?: string;
          };
          if (topup.user_id === user.id) return;
          if (topup.method !== "momo") return;
          adminAlert();
          toast({
            title: "💰 New MoMo Top-up Request!",
            description: `A user submitted a MoMo deposit of ₵${Number(topup.amount ?? 0).toFixed(2)} for approval.`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(adminOrdersChannel);
      supabase.removeChannel(adminTopupsChannel);
    };
  }, [user, isAdmin, toast, adminAlert]);

  // Chat message notifications
  useEffect(() => {
    if (!user) return;

    const chatChannel = supabase
      .channel(`chat-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }),
        },
        (payload) => {
          const msg = payload.new as {
            sender_role?: string;
            user_id?: string;
            message?: string;
          };

          if (isAdmin && msg.sender_role === "admin") return;
          if (!isAdmin && msg.sender_role === "user") return;

          playNotificationSound();
          vibrate();

          toast({
            title: isAdmin ? "💬 New Chat Message" : "💬 New Reply",
            description: isAdmin
              ? `A user sent: "${(msg.message ?? "").slice(0, 60)}${(msg.message ?? "").length > 60 ? "…" : ""}"`
              : `Support replied: "${(msg.message ?? "").slice(0, 60)}${(msg.message ?? "").length > 60 ? "…" : ""}"`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [user, isAdmin, toast]);

  // Complaint notifications – users get notified when admin replies, admins get notified on new complaints
  useEffect(() => {
    if (!user) return;

    const complaintsChannel = supabase
      .channel(`complaints-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: isAdmin ? "INSERT" : "UPDATE",
          schema: "public",
          table: "complaints",
          ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }),
        },
        (payload) => {
          if (isAdmin) {
            const complaint = payload.new as { subject?: string; user_id?: string };
            if (complaint.user_id === user.id) return;
            playNotificationSound();
            vibrate();
            toast({
              title: "📋 New Complaint",
              description: `Subject: ${(complaint.subject ?? "").slice(0, 80)}`,
            });
          } else {
            const oldReply = (payload.old as { admin_reply?: string | null })?.admin_reply;
            const newReply = (payload.new as { admin_reply?: string | null; subject?: string })?.admin_reply;
            if (newReply && newReply !== oldReply) {
              playNotificationSound();
              vibrate();
              toast({
                title: "📋 Complaint Reply",
                description: `Admin replied to your complaint: "${newReply.slice(0, 60)}${newReply.length > 60 ? "…" : ""}"`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(complaintsChannel);
    };
  }, [user, isAdmin, toast]);

  return null;
}
