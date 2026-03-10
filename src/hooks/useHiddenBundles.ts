import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useHiddenBundles() {
  const [hiddenBundles, setHiddenBundles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("hidden_bundles").select("network_id, bundle_size");
      if (data) {
        setHiddenBundles(new Set(data.map((r: any) => `${r.network_id}::${r.bundle_size}`)));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const isHidden = (networkId: string, bundleSize: string) =>
    hiddenBundles.has(`${networkId}::${bundleSize}`);

  return { isHidden, loading };
}
