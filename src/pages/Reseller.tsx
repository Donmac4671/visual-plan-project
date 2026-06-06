import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { networks, formatCurrency } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Copy, Store, TrendingUp } from "lucide-react";

// Wholesale (cost) prices used to compute reseller profit. Kept in sync with admin profit cost map.
const COST_MAP: Record<string, Record<string, number>> = {
  mtn: {
    "1GB": 3.95, "2GB": 7.9, "3GB": 11.85, "4GB": 15.8, "5GB": 19.75, "6GB": 23.7,
    "7GB": 27.65, "8GB": 31.6, "10GB": 39.5, "15GB": 59.25, "20GB": 79, "25GB": 98.75,
    "30GB": 118.5, "40GB": 158, "50GB": 197.5,
  },
  telecel: {
    "2GB": 10, "3GB": 15, "5GB": 21.5, "10GB": 41, "15GB": 59, "20GB": 78,
    "25GB": 96, "30GB": 116, "40GB": 156, "50GB": 187,
  },
  "at-bigtime": {
    "15GB": 56, "20GB": 62, "30GB": 73, "40GB": 84, "50GB": 93, "60GB": 104,
    "70GB": 136, "80GB": 150, "90GB": 161, "100GB": 175, "130GB": 219, "140GB": 244,
    "150GB": 272, "200GB": 366,
  },
  "at-premium": {
    "1GB": 3.95, "2GB": 7.9, "3GB": 12, "4GB": 16, "5GB": 20, "6GB": 24,
    "7GB": 28, "8GB": 32, "10GB": 39.5, "12GB": 48, "15GB": 60, "20GB": 80,
    "25GB": 100, "30GB": 120,
  },
};

function getCost(networkId: string, size: string): number {
  return COST_MAP[networkId]?.[size] ?? 0;
}

export default function Reseller() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const isReseller = profile?.tier === "reseller";
  const resellerCode = profile?.agent_code || "";

  useEffect(() => {
    if (!user || !isReseller) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("reseller_prices")
        .select("network_id, bundle_size, price")
        .eq("reseller_id", user.id);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[`${r.network_id}::${r.bundle_size}`] = Number(r.price);
      });
      setPriceMap(map);
    })();

    (async () => {
      const { data: custs } = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name, email, phone, created_at")
        .eq("reseller_id", user.id)
        .order("created_at", { ascending: false });
      setCustomers(custs || []);

      const customerIds = (custs || []).map((c: any) => c.user_id);
      if (customerIds.length > 0) {
        const { data: ords } = await supabase
          .from("orders")
          .select("network, bundle_size, amount, status, created_at, user_id")
          .in("user_id", customerIds)
          .neq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1000);
        setOrders(ords || []);
      }
    })();
  }, [user, isReseller]);

  const profit = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    orders.forEach((o) => {
      revenue += Number(o.amount) || 0;
      cost += getCost(o.network, o.bundle_size);
    });
    return { revenue, cost, profit: revenue - cost, orderCount: orders.length };
  }, [orders]);

  const handleSave = async (networkId: string, bundleSize: string) => {
    const key = `${networkId}::${bundleSize}`;
    const raw = drafts[key];
    const price = parseFloat(raw);
    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: "Invalid price", description: "Enter a positive number.", variant: "destructive" });
      return;
    }
    setSaving(key);
    const { error } = await (supabase as any)
      .from("reseller_prices")
      .upsert(
        { reseller_id: user!.id, network_id: networkId, bundle_size: bundleSize, price },
        { onConflict: "reseller_id,network_id,bundle_size" }
      );
    setSaving(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setPriceMap((prev) => ({ ...prev, [key]: price }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast({ title: "Saved", description: `${networkId.toUpperCase()} ${bundleSize} → ${formatCurrency(price)}` });
  };

  const storefrontUrl = `${window.location.origin}/?ref=${encodeURIComponent(resellerCode)}`;

  if (!isReseller) {
    return (
      <DashboardLayout title="My Storefront">
        <div className="text-center py-20 text-muted-foreground">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">This page is for resellers only.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Storefront">
      <div className="space-y-4">
        {/* Storefront link card */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Your storefront link</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Share this link. Anyone who signs up through it becomes your customer and sees your custom prices.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={storefrontUrl} className="text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(storefrontUrl);
                toast({ title: "Copied" });
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Your reseller code: <span className="font-mono font-semibold text-foreground">{resellerCode}</span>
          </p>
        </Card>

        {/* Profit summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Customers</p>
            <p className="text-xl font-bold">{customers.length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(profit.revenue)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Profit</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(profit.profit)}</p>
          </Card>
        </div>

        <Tabs defaultValue="prices">
          <TabsList>
            <TabsTrigger value="prices">Prices</TabsTrigger>
            <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="prices" className="space-y-4 mt-3">
            <p className="text-xs text-muted-foreground">
              Set the retail price your customers see. Your profit = your price − wholesale cost. Bundles you leave unset will fall back to the standard general price.
            </p>
            {networks.map((net) => (
              <Card key={net.id} className="p-3">
                <h3 className="font-semibold mb-2">{net.name}</h3>
                <div className="space-y-1.5">
                  {net.bundles.map((b) => {
                    const key = `${net.id}::${b.size}`;
                    const current = priceMap[key];
                    const cost = getCost(net.id, b.size);
                    const draft = drafts[key];
                    const editing = draft !== undefined;
                    const showPrice = editing ? draft : (current !== undefined ? String(current) : "");
                    const numPrice = parseFloat(showPrice);
                    const margin = Number.isFinite(numPrice) ? numPrice - cost : null;
                    return (
                      <div key={b.size} className="flex items-center gap-2 text-sm">
                        <div className="w-16 font-medium">{b.size}</div>
                        <div className="w-24 text-xs text-muted-foreground">Cost: {formatCurrency(cost)}</div>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder={`${b.generalPrice}`}
                          value={showPrice}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="h-8 w-24"
                        />
                        <div className={`w-20 text-xs ${margin !== null && margin > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {margin !== null ? `+${formatCurrency(margin)}` : ""}
                        </div>
                        <Button
                          size="sm"
                          variant={editing ? "default" : "outline"}
                          disabled={!editing || saving === key}
                          onClick={() => handleSave(net.id, b.size)}
                        >
                          {saving === key ? "…" : "Save"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="customers" className="mt-3">
            <Card className="p-3">
              {customers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No customers yet. Share your storefront link above to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {customers.map((c) => (
                    <div key={c.user_id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{c.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{c.phone} • {c.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
