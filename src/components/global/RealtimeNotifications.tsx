import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Persist a single AudioContext so it survives browser autoplay restrictions.
// We unlock it on the very first user interaction (click / touch / keydown).
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx) {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

// Unlock the AudioContext on the first user gesture
function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume();
  }
  // Only need to unlock once
  window.removeEventListener("click", unlockAudio);
  window.removeEventListener("touchstart", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("click", unlockAudio);
window.addEventListener("touchstart", unlockAudio);
window.addEventListener("keydown", unlockAudio);

function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Try resuming just in case
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1174;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.7);
  } catch {
    // Web Audio not supported
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

  return null;
}
