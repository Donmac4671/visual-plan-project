import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivePromo {
  id: string;
  discount_percent: number;
  description: string;
  starts_at: string;
  expires_at: string;
  target_audience: string;
}

export function useActivePromo(userTier?: string) {
  const [promos, setPromos] = useState<ActivePromo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPromos = async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, discount_percent, description, starts_at, expires_at, target_audience")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch promotions:", error.message);
      }

      if (!isMounted) return;

      setPromos((data as ActivePromo[]) || []);
      setLoading(false);
    };

    fetchPromos();

    return () => {
      isMounted = false;
    };
  }, []);

  const audienceMatches = (audience: string) => {
    if (audience === "everyone") return true;
    if (audience === "agent" && userTier === "agent") return true;
    if (audience === "general" && userTier !== "agent") return true;
    return false;
  };

  // Currently-running promo (started and not yet expired)
  const promo = useMemo(() => {
    const now = Date.now();
    const applicable = promos.filter((p) => {
      const startsAt = new Date(p.starts_at).getTime();
      const expiresAt = new Date(p.expires_at).getTime();
      if (Number.isNaN(expiresAt) || expiresAt < now) return false;
      const hasStarted = Number.isNaN(startsAt) || startsAt <= now;
      if (!hasStarted) return false;
      return audienceMatches(p.target_audience);
    });
    return applicable.sort(
      (a, b) => Number(b.discount_percent) - Number(a.discount_percent)
    )[0] || null;
  }, [promos, userTier]);

  // Upcoming promo (scheduled for the future, not yet started)
  const upcomingPromo = useMemo(() => {
    const now = Date.now();
    const upcoming = promos.filter((p) => {
      const startsAt = new Date(p.starts_at).getTime();
      const expiresAt = new Date(p.expires_at).getTime();
      if (Number.isNaN(startsAt) || startsAt <= now) return false;
      if (Number.isNaN(expiresAt) || expiresAt < now) return false;
      return audienceMatches(p.target_audience);
    });
    // Soonest first
    return upcoming.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )[0] || null;
  }, [promos, userTier]);

  const applyDiscount = (price: number): number => {
    if (!promo) return price;
    const discountPercent = Number(promo.discount_percent);
    if (Number.isNaN(discountPercent) || discountPercent <= 0) return price;
    const discounted = price * (1 - discountPercent / 100);
    return Math.round(discounted * 100) / 100;
  };

  return { promo, upcomingPromo, loading, applyDiscount };
}
