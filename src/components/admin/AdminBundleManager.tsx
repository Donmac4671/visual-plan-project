import { useState, useEffect } from "react";
import { networks, formatCurrency, getBundlePrice } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function AdminBundleManager() {
  const { toast } = useToast();
  const [hiddenBundles, setHiddenBundles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const makeKey = (networkId: string, bundleSize: string) => `${networkId}::${bundleSize}`;

  const fetchHidden = async () => {
    const { data } = await supabase.from("hidden_bundles").select("network_id, bundle_size");
    if (data) {
      setHiddenBundles(new Set(data.map((r: any) => makeKey(r.network_id, r.bundle_size))));
    }
  };

  useEffect(() => { fetchHidden(); }, []);

  const toggleBundle = async (networkId: string, bundleSize: string) => {
    const key = makeKey(networkId, bundleSize);
    setLoading(key);

    if (hiddenBundles.has(key)) {
      // Unhide: delete the row
      const { error } = await supabase
        .from("hidden_bundles")
        .delete()
        .eq("network_id", networkId)
        .eq("bundle_size", bundleSize);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setHiddenBundles(prev => { const n = new Set(prev); n.delete(key); return n; });
        toast({ title: "Bundle shown", description: `${networkId.toUpperCase()} ${bundleSize} is now visible` });
      }
    } else {
      // Hide: insert a row
      const { error } = await supabase
        .from("hidden_bundles")
        .insert({ network_id: networkId, bundle_size: bundleSize });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setHiddenBundles(prev => new Set(prev).add(key));
        toast({ title: "Bundle hidden", description: `${networkId.toUpperCase()} ${bundleSize} is now hidden` });
      }
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Toggle bundles on/off. Hidden bundles won't appear to users in the store or flyer.
      </p>
      {networks.map((network) => (
        <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className={`${network.gradient} py-3 px-4`}>
            <h3 className="text-lg font-bold text-white">{network.name}</h3>
          </div>
          <div className="divide-y divide-border">
            {network.bundles.map((bundle) => {
              const key = makeKey(network.id, bundle.size);
              const isHidden = hiddenBundles.has(key);
              const isLoading = loading === key;
              return (
                <div key={bundle.size} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground w-16">{bundle.size}</span>
                    <span className="text-sm text-muted-foreground">
                      Agent: {formatCurrency(bundle.price)} · General: {formatCurrency(bundle.generalPrice)}
                    </span>
                    {isHidden && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">Hidden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={!isHidden}
                    onCheckedChange={() => toggleBundle(network.id, bundle.size)}
                    disabled={isLoading}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
