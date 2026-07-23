import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { formatCurrency } from "@/lib/data";

interface CostRow {
  id: string;
  network: string;
  bundle_size: string;
  cost: number;
}

const NETWORK_ORDER = [
  "MTN",
  "TELECEL",
  "AT BIG TIME",
  "AT PREMIUM",
];

export default function AdminCostPrices() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [formNetwork, setFormNetwork] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formCost, setFormCost] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_cost_prices")
      .select("*")
      .order("network")
      .order("bundle_size");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as CostRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, CostRow[]> = {};
    for (const r of rows) {
      if (!map[r.network]) map[r.network] = [];
      map[r.network].push(r);
    }
    // sort within each network by numeric leading digits of bundle_size
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const na = parseFloat(a.bundle_size) || 0;
        const nb = parseFloat(b.bundle_size) || 0;
        return na - nb;
      });
    }
    const ordered: [string, CostRow[]][] = [];
    for (const n of NETWORK_ORDER) if (map[n]) ordered.push([n, map[n]]);
    for (const n of Object.keys(map)) if (!NETWORK_ORDER.includes(n)) ordered.push([n, map[n]]);
    return ordered;
  }, [rows]);

  const saveCost = async (row: CostRow) => {
    const raw = edits[row.id];
    if (raw === undefined) return;
    const value = parseFloat(raw);
    if (isNaN(value) || value < 0) {
      toast({ title: "Invalid cost", variant: "destructive" });
      return;
    }
    setSaving(row.id);
    const { error } = await supabase
      .from("admin_cost_prices")
      .update({ cost: value })
      .eq("id", row.id);
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cost updated", description: `${row.network} ${row.bundle_size} → ${formatCurrency(value)}` });
    setEdits((p) => {
      const n = { ...p };
      delete n[row.id];
      return n;
    });
    fetchRows();
  };

  const deleteRow = async (row: CostRow) => {
    if (!confirm(`Delete cost for ${row.network} ${row.bundle_size}?`)) return;
    const { error } = await supabase.from("admin_cost_prices").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    fetchRows();
  };

  const addRow = async () => {
    if (!formNetwork || !formSize || !formCost) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    const value = parseFloat(formCost);
    if (isNaN(value) || value < 0) {
      toast({ title: "Invalid cost", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("admin_cost_prices").upsert(
      { network: formNetwork.trim(), bundle_size: formSize.trim(), cost: value },
      { onConflict: "network,bundle_size" },
    );
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cost added" });
    setShowAdd(false);
    setFormNetwork("");
    setFormSize("");
    setFormCost("");
    fetchRows();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Admin Cost Prices</h2>
          <p className="text-sm text-muted-foreground">
            Wholesale cost from GHData. Edits take effect immediately in profit analytics.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([network, items]) => (
            <div key={network} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 font-semibold flex items-center justify-between">
                <span>{network}</span>
                <Badge variant="outline">{items.length} bundles</Badge>
              </div>
              <div className="divide-y divide-border">
                {items.map((r) => {
                  const dirty = edits[r.id] !== undefined && parseFloat(edits[r.id]) !== r.cost;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="font-medium w-24">{r.bundle_size}</span>
                      <span className="text-xs text-muted-foreground w-20">
                        Current: {formatCurrency(r.cost)}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={r.cost}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.id]: e.target.value }))}
                        className="max-w-[140px]"
                      />
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "ghost"}
                        disabled={!dirty || saving === r.id}
                        onClick={() => saveCost(r)}
                        className="gap-1"
                      >
                        <Save className="w-4 h-4" />
                        {saving === r.id ? "…" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteRow(r)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Cost Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Network (must match order's network exactly)</label>
              <Input
                placeholder="e.g. MTN, TELECEL, AT BIG TIME"
                value={formNetwork}
                onChange={(e) => setFormNetwork(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bundle Size</label>
              <Input
                placeholder="e.g. 25GB"
                value={formSize}
                onChange={(e) => setFormSize(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Cost (₵)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 93.47"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={addRow}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
