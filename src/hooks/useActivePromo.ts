import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivePromo {
  id: string;
  discount_percent: number;
  description: string;
  expires_at: string;
}

export function useActivePromo() {
  const [promo, setPromo] = useState<ActivePromo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("promotions")
        .select("id, discount_percent, description, expires_at")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setPromo(data[0] as ActivePromo);
      } else {
        setPromo(null);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const applyDiscount = (price: number): number => {
    if (!promo) return price;
    const discounted = price * (1 - promo.discount_percent / 100);
    return Math.round(discounted * 100) / 100;
  };

  return { promo, loading, applyDiscount };
}
