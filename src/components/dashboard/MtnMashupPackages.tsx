import { useState } from "react";
import { ChevronDown, ChevronUp, Smartphone, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { useHiddenBundles } from "@/hooks/useHiddenBundles";


const MTN_PREFIXES = ["024", "054", "055", "059", "025", "053"];
const isMTNNumber = (phone: string) => MTN_PREFIXES.some((p) => phone.startsWith(p));

export interface MashupDataPkg {
  size: string;
  sizeGB: number;
  price: number;
}
export interface MashupComboPkg {
  size: string;
  label: string;
  minutes: number;
  data: string;
  price: number;
}

export const MTN_MASHUP_DATA_PACKAGES: MashupDataPkg[] = [
  { size: "1.7GB",  sizeGB: 1.7,  price: 6 },
  { size: "3.4GB",  sizeGB: 3.4,  price: 12 },
  { size: "5.1GB",  sizeGB: 5.1,  price: 18 },
  { size: "6.8GB",  sizeGB: 6.8,  price: 24 },
  { size: "8.5GB",  sizeGB: 8.5,  price: 30 },
  { size: "10.2GB", sizeGB: 10.2, price: 36 },
  { size: "15.3GB", sizeGB: 15.3, price: 54 },
  { size: "20.4GB", sizeGB: 20.4, price: 72 },
];

export const MTN_MASHUP_COMBO_PACKAGES: MashupComboPkg[] = [
  { size: "350m+870MB",  label: "350 Minutes + 870MB",  minutes: 350,  data: "870MB", price: 20 },
  { size: "700m+1.6GB",  label: "700 Minutes + 1.6GB",  minutes: 700,  data: "1.6GB", price: 30 },
  { size: "1000m+2.6GB", label: "1000 Minutes + 2.6GB", minutes: 1000, data: "2.6GB", price: 40 },
  { size: "1400m+3.5GB", label: "1400 Minutes + 3.5GB", minutes: 1400, data: "3.5GB", price: 50 },
];

type Selected =
  | { kind: "data"; pkg: MashupDataPkg }
  | { kind: "combo"; pkg: MashupComboPkg }
  | null;

const OnlineBadge = () => (
  <span className="absolute top-1 right-1 flex items-center gap-1 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow">
    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Online
  </span>
);

export default function MtnMashupPackages() {
  const [expanded, setExpanded] = useState<null | "data" | "combo">(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [phone, setPhone] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();
  const { isHidden } = useHiddenBundles();

  const visibleData = MTN_MASHUP_DATA_PACKAGES.filter((p) => !isHidden("mashup-data", p.size));
  const visibleCombo = MTN_MASHUP_COMBO_PACKAGES.filter((p) => !isHidden("mashup-combo", p.size));

  const close = () => {
    setSelected(null);
    setPhone("");
  };

  const handleAdd = () => {
    if (!selected) return;
    if (!/^\d{10}$/.test(phone)) {
      toast({ title: "Invalid phone number", description: "Enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (!isMTNNumber(phone)) {
      toast({ title: "MTN Only", description: "These packages are only available for MTN numbers (024, 054, 055, 059, 025, 053)", variant: "destructive" });
      return;
    }

    if (selected.kind === "data") {
      const p = selected.pkg;
      addItem(
        "mashup-data",
        "MTN Mashup Data",
        { size: p.size, sizeGB: p.sizeGB, price: p.price, generalPrice: p.price },
        phone,
        p.price,
      );
      toast({ title: "Added to cart", description: `MTN Mashup Data ${p.size} for ${phone}` });
    } else {
      const p = selected.pkg;
      addItem(
        "mashup-combo",
        "MTN Mashup Combo",
        { size: p.size, sizeGB: 0, price: p.price, generalPrice: p.price },
        phone,
        p.price,
      );
      toast({ title: "Added to cart", description: `MTN Mashup ${p.label} for ${phone}` });
    }
    close();
  };

  return (
    <div className="space-y-3">
      {visibleData.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === "data" ? null : "data")}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">MTN Mashup Data</p>
                <p className="text-xs text-muted-foreground">Discounted MTN data bundles (MTN only)</p>
              </div>
            </div>
            {expanded === "data" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {expanded === "data" && (
            <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleData.map((p) => (
                <button
                  key={p.size}
                  onClick={() => setSelected({ kind: "data", pkg: p })}
                  className="relative bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-3 pt-5 text-white text-center hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <OnlineBadge />
                  <p className="text-2xl font-bold">{p.size}</p>
                  <p className="text-xs mt-1 opacity-90">{formatCurrency(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visibleCombo.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === "combo" ? null : "combo")}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">MTN Mashup Minutes + Data</p>
                <p className="text-xs text-muted-foreground">Minutes + data combo packages (MTN only)</p>
              </div>
            </div>
            {expanded === "combo" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {expanded === "combo" && (
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {visibleCombo.map((p) => (
                <button
                  key={p.size}
                  onClick={() => setSelected({ kind: "combo", pkg: p })}
                  className="relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-3 pt-5 text-white text-center hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <OnlineBadge />
                  <p className="text-lg font-bold">{p.minutes} mins</p>
                  <p className="text-xs opacity-90">+ {p.data}</p>
                  <p className="text-sm font-semibold mt-1">{formatCurrency(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected?.kind === "data"
                ? `MTN Mashup Data ${selected.pkg.size}`
                : selected?.kind === "combo"
                ? `MTN Mashup ${selected.pkg.label}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="bg-accent rounded-xl p-3 text-center">
                <p className="text-sm font-semibold">
                  {selected.kind === "data"
                    ? `${selected.pkg.size} for ${formatCurrency(selected.pkg.price)}`
                    : `${selected.pkg.label} — ${formatCurrency(selected.pkg.price)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">⚠️ MTN numbers only</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">📞 MTN Phone Number</label>
                <Input
                  placeholder="e.g., 0549358359"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
                <Button className="flex-1 gradient-primary border-0" onClick={handleAdd}>Add to Cart</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
