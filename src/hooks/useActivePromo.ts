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

  const promo = useMemo(() => {
    const now = Date.now();

    const applicablePromos = promos.filter((p) => {
      const startsAt = new Date(p.starts_at).getTime();
      const expiresAt = new Date(p.expires_at).getTime();
      const hasValidExpiry = !Number.isNaN(expiresAt) && expiresAt >= now;
      const hasStarted =
        Number.isNaN(startsAt) ||
        startsAt <= now ||
        (!Number.isNaN(expiresAt) && startsAt > expiresAt);

      if (!hasValidExpiry || !hasStarted) return false;
      if (p.target_audience === "everyone") return true;
      if (p.target_audience === "agent" && userTier === "agent") return true;
      if (p.target_audience === "general" && userTier !== "agent") return true;
      return false;
    });

    return applicablePromos.sort(
      (a, b) => Number(b.discount_percent) - Number(a.discount_percent)
    )[0] || null;
  }, [promos, userTier]);

  const applyDiscount = (price: number): number => {
    if (!promo) return price;
    const discountPercent = Number(promo.discount_percent);
    if (Number.isNaN(discountPercent) || discountPercent <= 0) return price;

    const discounted = price * (1 - discountPercent / 100);
    return Math.round(discounted * 100) / 100;
  };

  return { promo, loading, applyDiscount };
}
