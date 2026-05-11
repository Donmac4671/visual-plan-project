import { useState } from "react";
import { Phone, Smartphone, ShoppingCart, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { MASHUP_PACKAGES, MashupPackage, TELECEL_VS_PACKAGES, TelecelVSPackage, TelecelVSVariant, AIRTIME_MIN, AIRTIME_MAX, formatCurrency } from "@/lib/data";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useProductToggles } from "@/hooks/useProductToggles";

type Mode = null | "mashup" | "airtime" | "vs";

// MTN prefixes for Mashup validation
const MTN_PREFIXES = ["024", "054", "055", "059", "050", "0257"];
// Telecel prefixes for Voice & SMS validation
const TELECEL_PREFIXES = ["020", "050"];

function isMTNNumber(phone: string): boolean {
  return MTN_PREFIXES.some((prefix) => phone.startsWith(prefix));
}

function isTelecelNumber(phone: string): boolean {
  return TELECEL_PREFIXES.some((prefix) => phone.startsWith(prefix));
}

export default function MashupAirtime() {
  const [expanded, setExpanded] = useState<Mode>(null);
  const [pkg, setPkg] = useState<MashupPackage | null>(null);
  const [vsPkg, setVsPkg] = useState<TelecelVSPackage | null>(null);
  const [airtimeOpen, setAirtimeOpen] = useState(false);
  const [mashupPhone, setMashupPhone] = useState("");
  const [vsPhone, setVsPhone] = useState("");
  const [airtimePhone, setAirtimePhone] = useState("");
  const [airtimeAmount, setAirtimeAmount] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();
  const { mashupEnabled, airtimeEnabled, vsEnabled } = useProductToggles();

  const isValidPhone = (phone: string) => /^\d{10}$/.test(phone);

  const closeMashup = () => {
    setPkg(null);
    setMashupPhone("");
  };

  const closeVs = () => {
    setVsPkg(null);
    setVsPhone("");
  };

  const closeAirtime = () => {
    setAirtimeOpen(false);
    setAirtimePhone("");
    setAirtimeAmount("");
  };

  const handleAddVs = () => {
    if (!vsPkg) return;
    if (!isValidPhone(vsPhone)) {
      toast({ title: "Invalid phone number", description: "Enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (!isTelecelNumber(vsPhone)) {
      toast({
        title: "Telecel Only",
        description: "Telecel Voice + Data + SMS packages are only available for Telecel numbers (020, 050)",
        variant: "destructive",
      });
      return;
    }
    const parts = [vsPkg.minutes, vsPkg.data, vsPkg.sms].filter(Boolean).join(" + ");
    const sizeLabel = `Telecel V+D+S ${formatCurrency(vsPkg.price)} (${parts}${vsPkg.validity ? `, ${vsPkg.validity}` : ""}${vsPkg.allNetworks ? ", all networks" : ""})`;
    addItem(
      "vs",
      "Telecel V+D+S",
      { size: sizeLabel, sizeGB: 0, price: vsPkg.price, generalPrice: vsPkg.price },
      vsPhone,
      vsPkg.price,
    );
    toast({ title: "Added to cart", description: `Telecel V+D+S ${formatCurrency(vsPkg.price)} for ${vsPhone}` });
    closeVs();
  };

  const handleAddMashup = () => {
    if (!pkg) return;

    if (!isValidPhone(mashupPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    // Mashup ONLY works with MTN numbers
    if (!isMTNNumber(mashupPhone)) {
      toast({
        title: "MTN Only",
        description: "MashUp packages are only available for MTN numbers (024, 054, 055, 059, 020, 050)",
        variant: "destructive",
      });
      return;
    }

    addItem(
      "mashup",
      "MashUp",
      {
        size: `MashUp ${formatCurrency(pkg.price)} (${pkg.data} / ${pkg.minutes})`,
        sizeGB: 0,
        price: pkg.price,
        generalPrice: pkg.price,
      },
      mashupPhone,
      pkg.price,
    );

    toast({
      title: "Added to cart",
      description: `MashUp ${formatCurrency(pkg.price)} for MTN ${mashupPhone}`,
    });
    closeMashup();
  };

  const handleAddAirtime = () => {
    const amt = parseFloat(airtimeAmount);

    if (!isValidPhone(airtimePhone)) {
      toast({
        title: "Invalid phone number",
        description: "Enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(amt) || amt < AIRTIME_MIN || amt > AIRTIME_MAX) {
      toast({
        title: "Invalid amount",
        description: `Enter an amount between ${formatCurrency(AIRTIME_MIN)} and ${formatCurrency(AIRTIME_MAX)}`,
        variant: "destructive",
      });
      return;
    }

    addItem(
      "airtime",
      "Airtime",
      {
        size: `Airtime ${formatCurrency(amt)}`,
        sizeGB: 0,
        price: amt,
        generalPrice: amt,
      },
      airtimePhone,
      amt,
    );

    toast({
      title: "Added to cart",
      description: `Airtime ${formatCurrency(amt)} for ${airtimePhone}`,
    });
    closeAirtime();
  };

  if (!mashupEnabled && !airtimeEnabled && !vsEnabled) return null;

  return (
    <div className="space-y-3">
      {/* MashUp section */}
      {mashupEnabled && (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "mashup" ? null : "mashup")}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">MashUp</p>
              <p className="text-xs text-muted-foreground">Data + Minutes combo packages (MTN only)</p>
            </div>
          </div>
          {expanded === "mashup" ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {expanded === "mashup" && (
          <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MASHUP_PACKAGES.map((p) => (
              <button
                key={p.price}
                onClick={() => setPkg(p)}
                className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-3 text-white text-center hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <p className="text-2xl font-bold">{formatCurrency(p.price)}</p>
                <p className="text-[10px] mt-1 opacity-90">{p.data}</p>
                <p className="text-[10px] opacity-90">{p.minutes}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Airtime section */}
      {airtimeEnabled && (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "airtime" ? null : "airtime")}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Airtime</p>
              <p className="text-xs text-muted-foreground">
                Top up airtime (All networks) ₵{AIRTIME_MIN} - ₵{AIRTIME_MAX}
              </p>
            </div>
          </div>
          {expanded === "airtime" ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {expanded === "airtime" && (
          <div className="p-4 pt-0">
            <Button className="w-full gradient-primary border-0" onClick={() => setAirtimeOpen(true)}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Buy Airtime
            </Button>
          </div>
        )}
      </div>
      )}

      {/* Telecel Voice + Data + SMS section */}
      {vsEnabled && (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "vs" ? null : "vs")}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center overflow-hidden">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Telecel Voice + Data + SMS</p>
              <p className="text-xs text-muted-foreground">Minutes + Data + SMS combo packages (Telecel only)</p>
            </div>
          </div>
          {expanded === "vs" ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {expanded === "vs" && (
          <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TELECEL_VS_PACKAGES.map((p, idx) => (
              <button
                key={`${p.price}-${idx}`}
                onClick={() => setVsPkg(p)}
                className={`rounded-2xl p-3 text-white text-center hover:shadow-lg hover:-translate-y-1 transition-all ${p.allNetworks ? "bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-300" : "bg-gradient-to-br from-red-500 to-rose-600"}`}
              >
                {p.allNetworks && <p className="text-[9px] font-bold opacity-90">SPECIAL</p>}
                <p className="text-2xl font-bold">{formatCurrency(p.price)}</p>
                <p className="text-[10px] mt-1 opacity-90">{p.minutes}</p>
                {p.data && <p className="text-[10px] opacity-90">{p.data}</p>}
                <p className="text-[10px] opacity-90">{p.sms}</p>
                {p.validity && <p className="text-[9px] opacity-80">{p.validity}</p>}
                {p.allNetworks && <p className="text-[9px] opacity-90">All Networks</p>}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Telecel V+D+S dialog */}
      <Dialog open={!!vsPkg} onOpenChange={(o) => { if (!o) closeVs(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Telecel V+D+S {vsPkg ? formatCurrency(vsPkg.price) : ""}</DialogTitle>
          </DialogHeader>
          {vsPkg && (
            <div className="space-y-3">
              <div className="bg-accent rounded-xl p-3 text-center">
                <p className="text-sm font-semibold">
                  {[vsPkg.minutes, vsPkg.data, vsPkg.sms].filter(Boolean).join(" + ")}
                </p>
                {vsPkg.validity && <p className="text-xs text-muted-foreground mt-1">Validity: {vsPkg.validity}</p>}
                {vsPkg.allNetworks && <p className="text-xs text-amber-600 font-semibold mt-1">📞 Calls all networks</p>}
                {!vsPkg.validity && <p className="text-xs text-muted-foreground mt-1">No expiry</p>}
                <p className="text-xs text-muted-foreground mt-1">A small fee will be added at checkout</p>
                <p className="text-xs text-muted-foreground mt-1">⚠️ Telecel numbers only</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">📞 Telecel Phone Number</label>
                <Input
                  placeholder="e.g., 0202345678"
                  value={vsPhone}
                  onChange={(e) => setVsPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={closeVs}>Cancel</Button>
                <Button className="flex-1 gradient-primary border-0" onClick={handleAddVs}>Add to Cart</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pkg}
        onOpenChange={(o) => {
          if (!o) closeMashup();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>MashUp {pkg ? formatCurrency(pkg.price) : ""}</DialogTitle>
          </DialogHeader>
          {pkg && (
            <div className="space-y-3">
              <div className="bg-accent rounded-xl p-3 text-center">
                <p className="text-sm font-semibold">
                  {pkg.data} + {pkg.minutes}
                </p>
                <p className="text-xs text-muted-foreground mt-1">A small fee will be added at checkout</p>
                <p className="text-xs text-muted-foreground mt-1">⚠️ MTN numbers only</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">📞 MTN Phone Number</label>
                <Input
                  placeholder="e.g., 0549358359"
                  value={mashupPhone}
                  onChange={(e) => setMashupPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={closeMashup}>
                  Cancel
                </Button>
                <Button className="flex-1 gradient-primary border-0" onClick={handleAddMashup}>
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Airtime dialog */}
      <Dialog
        open={airtimeOpen}
        onOpenChange={(o) => {
          if (!o) closeAirtime();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy Airtime</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">📞 Phone Number (Any Network)</label>
              <Input
                placeholder="e.g., 0549358359"
                value={airtimePhone}
                onChange={(e) => setAirtimePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                💰 Amount (₵{AIRTIME_MIN} - ₵{AIRTIME_MAX})
              </label>
              <Input
                type="number"
                step="0.5"
                min={AIRTIME_MIN}
                max={AIRTIME_MAX}
                placeholder="e.g., 10"
                value={airtimeAmount}
                onChange={(e) => setAirtimeAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeAirtime}>
                Cancel
              </Button>
              <Button className="flex-1 gradient-primary border-0" onClick={handleAddAirtime}>
                Add to Cart
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
