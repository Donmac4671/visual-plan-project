import { useState } from "react";
import { Phone, Smartphone, ShoppingCart, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { MASHUP_PACKAGES, MashupPackage, TELECEL_VS_PACKAGES, TelecelVSPackage, AIRTIME_MIN, AIRTIME_MAX, formatCurrency } from "@/lib/data";
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
  const [vsVariantIdx, setVsVariantIdx] = useState<number>(0);
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
    setVsVariantIdx(0);
    setVsPhone("");
  };

  const closeAirtime = () => {
    setAirtimeOpen(false);
    setAirtimePhone("");
    setAirtimeAmount("");
  };

  const handleAddVs = () => {
    if (!vsPkg) return;
    const variant = vsPkg.variants[vsVariantIdx];
    if (!variant) return;
    if (!isValidPhone(vsPhone)) {
      toast({ title: "Invalid phone number", description: "Enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (!isTelecelNumber(vsPhone)) {
      toast({
        title: "Telecel Only",
        description: "Telecel packages are only available for Telecel numbers (020, 050)",
        variant: "destructive",
      });
      return;
    }
    const productName = variant.kind === "vds" ? "Telecel V+D+S" : "Telecel V&S";
    const parts = [variant.minutes, variant.data, variant.sms].filter(Boolean).join(" + ");
    const sizeLabel = `${productName} ${formatCurrency(vsPkg.price)} (${parts}${variant.validity ? `, ${variant.validity}` : ""}${variant.allNetworks ? ", all networks" : ""})`;
    addItem(
      "vs",
      productName,
      { size: sizeLabel, sizeGB: 0, price: vsPkg.price, generalPrice: vsPkg.price },
      vsPhone,
      vsPkg.price,
    );
    toast({ title: "Added to cart", description: `${productName} ${formatCurrency(vsPkg.price)} for ${vsPhone}` });
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
            {TELECEL_VS_PACKAGES.map((p, idx) => {
              const hasChoice = p.variants.length > 1;
              const first = p.variants[0];
              return (
                <button
                  key={`${p.price}-${idx}`}
                  onClick={() => { setVsPkg(p); setVsVariantIdx(0); }}
                  className={`rounded-2xl p-3 text-white text-center hover:shadow-lg hover:-translate-y-1 transition-all ${p.isSpecial ? "bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-300" : "bg-gradient-to-br from-red-500 to-rose-600"}`}
                >
                  {p.isSpecial && <p className="text-[9px] font-bold opacity-90">SPECIAL</p>}
                  <p className="text-2xl font-bold">{formatCurrency(p.price)}</p>
                  {hasChoice ? (
                    <p className="text-[10px] mt-1 opacity-90">2 offers — tap to choose</p>
                  ) : (
                    <>
                      <p className="text-[10px] mt-1 opacity-90">{first.minutes}</p>
                      {first.data && <p className="text-[10px] opacity-90">{first.data}</p>}
                      <p className="text-[10px] opacity-90">{first.sms}</p>
                      {first.validity && <p className="text-[9px] opacity-80">{first.validity}</p>}
                      {first.allNetworks && <p className="text-[9px] opacity-90">All Networks</p>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Telecel V+D+S dialog */}
      <Dialog open={!!vsPkg} onOpenChange={(o) => { if (!o) closeVs(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden rounded-2xl border-0">
          {vsPkg && (() => {
            const variant = vsPkg.variants[vsVariantIdx];
            const phoneValid = isValidPhone(vsPhone) && isTelecelNumber(vsPhone);
            const wrongNet = vsPhone.length === 10 && !isTelecelNumber(vsPhone);
            const headerBg = vsPkg.isSpecial
              ? "linear-gradient(135deg,#f59e0b 0%,#ea580c 100%)"
              : "linear-gradient(135deg,#EE2722 0%,#b91c1c 100%)";
            return (
              <>
                <div style={{ background: headerBg, color: "#fff" }} className="relative px-5 pt-6 pb-8">
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-black/10 blur-2xl" />
                  <DialogHeader className="relative">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/20 ring-2 ring-white/40 shadow-lg flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-white">
                          {vsPkg.isSpecial ? "Telecel Special" : "Telecel V+D+S"} — {formatCurrency(vsPkg.price)}
                        </DialogTitle>
                        <p className="text-xs opacity-80">Confirm details to add to cart</p>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-5 -mt-5 pb-5 space-y-4">
                  {vsPkg.variants.length > 1 ? (
                    <div className="bg-card rounded-2xl border border-border shadow-md p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Choose your offer</p>
                      <RadioGroup value={String(vsVariantIdx)} onValueChange={(v) => setVsVariantIdx(Number(v))} className="gap-2">
                        {vsPkg.variants.map((v, i) => {
                          const desc = [v.minutes, v.data, v.sms].filter(Boolean).join(" + ");
                          const tag = v.kind === "vds" ? "Voice + Data + SMS" : "Voice + SMS";
                          return (
                            <Label
                              key={i}
                              htmlFor={`vs-var-${i}`}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${vsVariantIdx === i ? "border-red-500 bg-red-500/5" : "border-border"}`}
                            >
                              <RadioGroupItem value={String(i)} id={`vs-var-${i}`} className="mt-1" />
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">{tag}</p>
                                <p className="text-sm font-semibold">{desc}</p>
                              </div>
                            </Label>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border shadow-md p-4 text-center">
                      <p className="text-sm font-semibold">
                        {[variant.minutes, variant.data, variant.sms].filter(Boolean).join(" + ")}
                      </p>
                      {variant.allNetworks && <p className="text-xs text-amber-600 font-semibold mt-1">📞 Calls all networks</p>}
                    </div>
                  )}

                  <div className="bg-card rounded-2xl border border-border shadow-md p-4 grid grid-cols-2 divide-x divide-border">
                    <div className="pr-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Price</p>
                      <p className="text-2xl font-extrabold">{formatCurrency(vsPkg.price)}</p>
                    </div>
                    <div className="pl-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Validity</p>
                      <p className="text-xl font-extrabold">{variant?.validity ?? "No expiry"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Telecel Phone Number
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border-2 bg-background px-3 transition-colors ${
                      vsPhone.length === 0 ? "border-border" : phoneValid ? "border-green-500" : "border-destructive"
                    }`}>
                      <span className="text-lg">📞</span>
                      <Input
                        placeholder="0202345678"
                        value={vsPhone}
                        onChange={(e) => setVsPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        inputMode="numeric"
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base font-semibold tracking-wider"
                      />
                      {phoneValid && <span className="text-green-600 text-lg">✓</span>}
                    </div>
                    {wrongNet && <p className="text-xs text-destructive mt-1.5 ml-1 font-semibold">⚠️ Not a Telecel number (020, 050)</p>}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={closeVs}>Cancel</Button>
                    <Button className="flex-1 h-11 rounded-xl gradient-primary border-0 font-semibold" onClick={handleAddVs} disabled={!phoneValid}>
                      <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
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
      <Dialog open={airtimeOpen} onOpenChange={(o) => { if (!o) closeAirtime(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden rounded-2xl border-0">
          {(() => {
            const phoneValid = isValidPhone(airtimePhone);
            const amt = parseFloat(airtimeAmount);
            const amtValid = Number.isFinite(amt) && amt >= AIRTIME_MIN && amt <= AIRTIME_MAX;
            return (
              <>
                <div style={{ background: "linear-gradient(135deg,#10b981 0%,#0d9488 100%)" }} className="relative px-5 pt-6 pb-8 text-white">
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-black/10 blur-2xl" />
                  <DialogHeader className="relative">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/20 ring-2 ring-white/40 shadow-lg flex items-center justify-center">
                        <Phone className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-white">Buy Airtime</DialogTitle>
                        <p className="text-xs opacity-80">Works on all Ghana networks</p>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-5 -mt-5 pb-5 space-y-4">
                  <div className="bg-card rounded-2xl border border-border shadow-md p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Allowed amount</p>
                    <p className="text-xl font-extrabold">₵{AIRTIME_MIN} – ₵{AIRTIME_MAX}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Recipient Phone Number
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border-2 bg-background px-3 transition-colors ${
                      airtimePhone.length === 0 ? "border-border" : phoneValid ? "border-green-500" : "border-destructive"
                    }`}>
                      <span className="text-lg">📞</span>
                      <Input
                        placeholder="0549358359"
                        value={airtimePhone}
                        onChange={(e) => setAirtimePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        inputMode="numeric"
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base font-semibold tracking-wider"
                      />
                      {phoneValid && <span className="text-green-600 text-lg">✓</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Amount (₵)
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border-2 bg-background px-3 transition-colors ${
                      airtimeAmount.length === 0 ? "border-border" : amtValid ? "border-green-500" : "border-destructive"
                    }`}>
                      <span className="text-lg">💰</span>
                      <Input
                        type="number"
                        step="0.5"
                        min={AIRTIME_MIN}
                        max={AIRTIME_MAX}
                        placeholder="10"
                        value={airtimeAmount}
                        onChange={(e) => setAirtimeAmount(e.target.value)}
                        inputMode="decimal"
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base font-semibold tracking-wider"
                      />
                      {amtValid && <span className="text-green-600 text-lg">✓</span>}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={closeAirtime}>Cancel</Button>
                    <Button className="flex-1 h-11 rounded-xl gradient-primary border-0 font-semibold" onClick={handleAddAirtime} disabled={!phoneValid || !amtValid}>
                      <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
