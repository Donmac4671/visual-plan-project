import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ResellerPriceRow {
  network_id: string;
  bundle_size: string;
  price: number;
}

/** Returns custom prices for the reseller this customer is linked to (empty when not linked). */
export function useResellerPrices() {
  const { profile } = useAuth();
  const resellerId = (profile as any)?.reseller_id as string | null | undefined;
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!resellerId) {
      setPrices({});
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("reseller_prices")
        .select("network_id, bundle_size, price")
        .eq("reseller_id", resellerId);
      if (!cancelled && !error && data) {
        const map: Record<string, number> = {};
        (data as ResellerPriceRow[]).forEach((r) => {
          map[`${r.network_id}::${r.bundle_size}`] = Number(r.price);
        });
        setPrices(map);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resellerId]);

  const getPrice = (networkId: string, bundleSize: string): number | undefined => {
    return prices[`${networkId}::${bundleSize}`];
  };

  return { prices, getPrice, loading, isResellerCustomer: !!resellerId };
}
