import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivePromo {
  id: string;
  discount_percent: number;
  description: string;
  expires_at: string;
  target_audience: string;
}

export function useActivePromo(userTier?: string) {
  const [promos, setPromos] = useState<ActivePromo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPromos = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("promotions")
        .select("id, discount_percent, description, expires_at, target_audience")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("expires_at", now)
        .order("created_at", { ascending: false });
      
      setPromos((data as ActivePromo[]) || []);
      setLoading(false);
    };
    fetchPromos();
  }, []);

  // Find the best applicable promo for the user's tier
  const promo = promos.find((p) => {
    if (p.target_audience === "everyone") return true;
    if (p.target_audience === "agent" && userTier === "agent") return true;
    if (p.target_audience === "general" && userTier !== "agent") return true;
    return false;
  }) || null;

  const applyDiscount = (price: number): number => {
    if (!promo) return price;
    const discounted = price * (1 - promo.discount_percent / 100);
    return Math.round(discounted * 100) / 100;
  };

  return { promo, loading, applyDiscount };
}
