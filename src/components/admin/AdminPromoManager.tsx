import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Percent } from "lucide-react";
import { format } from "date-fns";

interface Promo {
  id: string;
  discount_percent: number;
  description: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPromoManager() {
  const { toast } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [discount, setDiscount] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [targetAudience, setTargetAudience] = useState("general");
  const [creating, setCreating] = useState(false);

  const fetchPromos = async () => {
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });
    setPromos((data as Promo[]) || []);
  };

  useEffect(() => { fetchPromos(); }, []);

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const isCurrentlyActive = (p: Promo) => p.is_active && !isExpired(p.expires_at) && new Date(p.starts_at) <= new Date();

  const handleCreate = async () => {
    if (!discount || !expiresAt) {
      toast({ title: "Missing fields", description: "Please enter discount % and expiry date", variant: "destructive" });
      return;
    }
    const pct = parseFloat(discount);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Invalid discount", description: "Must be between 1 and 100", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("promotions").insert({
      discount_percent: pct,
      description: description || `${pct}% off for ${targetAudience === 'everyone' ? 'all users' : targetAudience === 'agent' ? 'agents' : 'general users'}`,
      expires_at: new Date(expiresAt).toISOString(),
      is_active: true,
      target_audience: targetAudience,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promo created!", description: `${pct}% discount active for general users` });
      setShowForm(false);
      setDiscount("");
      setDescription("");
      setExpiresAt("");
      setTargetAudience("general");
      fetchPromos();
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("promotions").update({ is_active: !active }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: active ? "Promo deactivated" : "Promo activated" });
      fetchPromos();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promo deleted" });
      fetchPromos();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create time-limited percentage discounts targeting general users, agents, or everyone.
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <Plus className="w-4 h-4" /> New Promo
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Percent className="w-4 h-4" /> Create Promotion
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Discount %</label>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="1"
                max="100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Expires at</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Target Audience</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              >
                <option value="general">General Users</option>
                <option value="agent">Agents Only</option>
                <option value="everyone">Everyone</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
              <Input
                placeholder="e.g. Weekend sale"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating ? "Creating..." : "Create Promo"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No promotions yet</div>
      ) : (
        <div className="space-y-2">
          {promos.map((p) => {
            const active = isCurrentlyActive(p);
            const expired = isExpired(p.expires_at);
            return (
              <div key={p.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-lg">{p.discount_percent}% off</span>
                    {active && <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Active</Badge>}
                    {expired && <Badge variant="outline" className="bg-destructive/10 text-destructive">Expired</Badge>}
                    {!p.is_active && !expired && <Badge variant="outline" className="bg-muted text-muted-foreground">Paused</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {format(new Date(p.expires_at), "MMM dd, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!expired && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(p.id, p.is_active)}
                    >
                      {p.is_active ? "Pause" : "Activate"}
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
