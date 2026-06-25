import { useState, useMemo } from "react";
import { Wifi, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Network, DataBundle, formatCurrency, getBundlePrice } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomBundles } from "@/hooks/useCustomBundles";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useResellerPrices } from "@/hooks/useResellerPrices";
import { useHiddenBundles } from "@/hooks/useHiddenBundles";
import { useProductToggles } from "@/hooks/useProductToggles";
import MtnMashupPackages from "@/components/dashboard/MtnMashupPackages";
import mtnLogo from "@/assets/networks/mtn.png";
import telecelLogo from "@/assets/networks/telecel.png";
import airteltigoLogo from "@/assets/networks/airteltigo.png";

const networkLogos: Record<string, string> = {
  mtn: mtnLogo,
  telecel: telecelLogo,
  "at-bigtime": airteltigoLogo,
  "at-premium": airteltigoLogo,
};

function NetworkIcon({ network }: { network: Network }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted">
      <img src={networkLogos[network.id]} alt={network.name} className="w-full h-full object-cover" />
    </div>
  );
}

// Brand colors (official)
const BRAND_BG: Record<string, string> = {
  mtn: "#FFCB05", // MTN bright yellow
  telecel: "#EE2722", // Telecel bright red
  "at-bigtime": "linear-gradient(135deg, #0066B3 0%, #0066B3 55%, #ED1C24 55%, #ED1C24 100%)", // AirtelTigo blue + red
  "at-premium": "linear-gradient(135deg, #0066B3 0%, #0066B3 55%, #ED1C24 55%, #ED1C24 100%)",
};
const BRAND_TEXT: Record<string, string> = {
  mtn: "#1a1a1a",
  telecel: "#ffffff",
  "at-bigtime": "#ffffff",
  "at-premium": "#ffffff",
};

function getValidity(networkId: string): string {
  if (networkId === "at-bigtime") return "Non-Expiry";
  if (networkId === "at-premium") return "60 Days";
  return "90 Days";
}

function BundleCard({ bundle, network, tier, onSelect, applyDiscount, resellerPrice, offline, onOfflineClick }: { bundle: DataBundle; network: Network; tier: string; onSelect: () => void; applyDiscount?: (price: number) => number; resellerPrice?: number; offline?: boolean; onOfflineClick?: () => void }) {
  const basePrice = resellerPrice ?? getBundlePrice(bundle, tier);
  const displayPrice = applyDiscount ? applyDiscount(basePrice) : basePrice;
  const hasDiscount = displayPrice < basePrice;
  const cardStyle = offline
    ? { background: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)", color: "#fff" }
    : { background: BRAND_BG[network.id] ?? undefined, color: BRAND_TEXT[network.id] ?? "#fff" };

  return (
    <div className="flex flex-col items-center">
      <div
        style={cardStyle}
        className={`rounded-2xl p-3 w-full aspect-square flex flex-col items-center justify-center text-center relative transition-all duration-200 ${offline ? "opacity-70" : "hover:shadow-lg hover:-translate-y-1 hover:scale-105"}`}
      >
        {offline ? (
          <span className="absolute top-1 right-1 flex items-center gap-1 bg-gray-700 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> Offline
          </span>
        ) : (
          <span className="absolute top-1 right-1 flex items-center gap-1 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Online
          </span>
        )}
        <span className="text-sm font-extrabold tracking-wide uppercase leading-tight">
          {network.name} {bundle.size}
        </span>
        <span className="text-2xl lg:text-3xl font-extrabold mt-1">
          {formatCurrency(displayPrice)}
        </span>
        {hasDiscount && (
          <span className="text-[10px] opacity-70 line-through leading-none">
            {formatCurrency(basePrice)}
          </span>
        )}
        <span className="text-[10px] font-medium opacity-90 mt-1">
          Validity: {getValidity(network.id)}
        </span>
      </div>
      <Button
        size="sm"
        className="mt-2 gradient-primary border-0 text-xs w-full"
        onClick={offline ? onOfflineClick : onSelect}
      >
        <ShoppingCart className="w-3 h-3 mr-1" /> {offline ? "Offline" : "Select Bundle"}
      </Button>
    </div>
  );
}

export default function DataBundles() {
  const [expandedNetwork, setExpandedNetwork] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<{ network: Network; bundle: DataBundle } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { networks: mergedNetworks } = useCustomBundles();
  const userTier = profile?.tier || "general";
  const { promo, applyDiscount } = useActivePromo(userTier);
  const { getPrice: getResellerPrice, isResellerCustomer } = useResellerPrices();
  const { isHidden } = useHiddenBundles();
  const { mtnEnabled, telecelEnabled, atPremiumEnabled, atBigtimeEnabled } = useProductToggles();

  const networkVisibility: Record<string, boolean> = {
    mtn: mtnEnabled,
    telecel: telecelEnabled,
    "at-premium": atPremiumEnabled,
    "at-bigtime": atBigtimeEnabled,
  };
  const visibleNetworks = mergedNetworks.filter((n) => networkVisibility[n.id] !== false);

  const toggleNetwork = (id: string) => {
    setExpandedNetwork(expandedNetwork === id ? null : id);
  };

  const networkPrefixes: Record<string, string[]> = {
    mtn: ["024", "025", "053", "054", "055", "059"],
    telecel: ["020", "050"],
    "at-bigtime": ["026", "027", "056", "057"],
    "at-premium": ["026", "027", "056", "057"],
  };

  // Special exceptions: specific numbers that work on a different network
  const mtnExceptions = ["0278213799"];

  const phonePrefix = phoneNumber.length >= 3 ? phoneNumber.slice(0, 3) : "";
  const detectedNetwork = useMemo(() => {
    if (phonePrefix.length < 3) return null;
    // Check exceptions first
    if (mtnExceptions.includes(phoneNumber)) return "mtn";
    for (const [netId, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(phonePrefix)) return netId;
    }
    return "unknown";
  }, [phonePrefix, phoneNumber]);

  const isWrongNetwork = useMemo(() => {
    if (!selectedBundle || !detectedNetwork || detectedNetwork === "unknown") return false;
    const selectedId = selectedBundle.network.id;
    // AirtelTigo networks share prefixes
    if ((selectedId === "at-bigtime" || selectedId === "at-premium") && (detectedNetwork === "at-bigtime" || detectedNetwork === "at-premium")) return false;
    return detectedNetwork !== selectedId;
  }, [detectedNetwork, selectedBundle]);

  const getExpectedNetworkName = (networkId: string) => {
    if (networkId === "mtn") return "MTN";
    if (networkId === "telecel") return "Telecel";
    if (networkId === "at-bigtime" || networkId === "at-premium") return "AirtelTigo";
    return networkId;
  };

  const handleAddToCart = () => {
    if (!selectedBundle || phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      toast({ title: "Error", description: "Please enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (isWrongNetwork) {
      const expected = getExpectedNetworkName(selectedBundle.network.id);
      toast({ title: "Wrong Network", description: `This number doesn't belong to ${expected}. Please enter a valid ${expected} number.`, variant: "destructive" });
      return;
    }
    if (detectedNetwork === "unknown") {
      toast({ title: "Unknown Number", description: "This phone number prefix is not recognized. Please check the number.", variant: "destructive" });
      return;
    }
    const resellerOverride = getResellerPrice(selectedBundle.network.id, selectedBundle.bundle.size);
    let effectivePrice = resellerOverride ?? getBundlePrice(selectedBundle.bundle, userTier);
    if (promo && !isResellerCustomer) {
      effectivePrice = applyDiscount(effectivePrice);
    }
    addItem(selectedBundle.network.id, selectedBundle.network.name, selectedBundle.bundle, phoneNumber, effectivePrice);
    toast({ title: "Added to cart", description: `${selectedBundle.network.name} ${selectedBundle.bundle.size} added` });
    setSelectedBundle(null);
    setPhoneNumber("");
  };

  return (
    <>
      <div className="gradient-primary rounded-2xl p-4 lg:p-5 mb-4">
        <div className="flex items-center gap-3">
          <Wifi className="w-6 h-6 text-primary-foreground" />
          <div>
            <h2 className="text-lg font-bold text-primary-foreground">Data Bundles</h2>
            <p className="text-sm text-primary-foreground/70">Select your network and choose a data package</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <MtnMashupPackages />
      </div>

      {promo && userTier !== "agent" && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm font-semibold text-green-700">🎉 {promo.discount_percent}% OFF all bundles! {promo.description}</p>
        </div>
      )}

      <div className="space-y-3">
        {visibleNetworks.map((network) => {
          if (network.bundles.length === 0) return null;
          return (
          <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => toggleNetwork(network.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <NetworkIcon network={network} />
                <div className="text-left">
                  <p className="font-semibold text-foreground">{network.name}</p>
                  <p className="text-xs text-muted-foreground">{network.bundles.length} data packages available</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                  {network.bundles.length} bundles
                </span>
                {expandedNetwork === network.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedNetwork === network.id && (
              <div className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {network.bundles.map((bundle) => (
                    <BundleCard
                      key={bundle.size}
                      bundle={bundle}
                      network={network}
                      tier={userTier}
                      onSelect={() => setSelectedBundle({ network, bundle })}
                      applyDiscount={promo && !isResellerCustomer ? applyDiscount : undefined}
                      resellerPrice={getResellerPrice(network.id, bundle.size)}
                      offline={isHidden(network.id, bundle.size)}
                      onOfflineClick={() => toast({ title: "Offline", description: `${network.name} ${bundle.size} is currently offline. Please check back later.`, variant: "destructive" })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Add to cart dialog */}
      <Dialog open={!!selectedBundle} onOpenChange={() => setSelectedBundle(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedBundle && <NetworkIcon network={selectedBundle.network} />}
              <div>
                <DialogTitle>{selectedBundle?.network.name} {selectedBundle?.bundle.size}</DialogTitle>
                <p className="text-sm text-muted-foreground">Add bundle to cart</p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-accent rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">💰 Price</p>
              {(() => {
                if (!selectedBundle) return null;
                const reseller = getResellerPrice(selectedBundle.network.id, selectedBundle.bundle.size);
                const base = reseller ?? getBundlePrice(selectedBundle.bundle, userTier);
                const final = promo && !isResellerCustomer ? applyDiscount(base) : base;
                const hasDiscount = final < base;
                return (
                  <>
                    {hasDiscount && <p className="text-sm text-muted-foreground line-through">{formatCurrency(base)}</p>}
                    <p className={`text-xl font-bold ${hasDiscount ? "text-green-600" : "text-foreground"}`}>{formatCurrency(final)}</p>
                  </>
                );
              })()}
            </div>
            <div className="bg-accent rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">⏱ Validity</p>
              <p className="text-xl font-bold text-foreground">
                {selectedBundle?.network.id === "at-bigtime" ? "Non-Expiry" : selectedBundle?.network.id === "at-premium" ? "60 Days" : "90 Days"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-foreground flex items-center gap-1 mb-2">
              📞 Recipient Phone Number
            </label>
            <Input
              placeholder="e.g., 0549358359"
              value={phoneNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhoneNumber(val);
              }}
              maxLength={10}
              inputMode="numeric"
            />
            {phoneNumber.length > 0 && phoneNumber.length < 10 && (
              <p className="text-xs text-destructive mt-1">{10 - phoneNumber.length} more digit(s) needed</p>
            )}
            {isWrongNetwork && selectedBundle && (
              <p className="text-xs text-destructive mt-1 font-semibold">
                ⚠️ This number doesn't look like a {getExpectedNetworkName(selectedBundle.network.id)} number
              </p>
            )}
            {detectedNetwork === "unknown" && phoneNumber.length >= 3 && (
              <p className="text-xs text-destructive mt-1">⚠️ Unrecognized phone number prefix</p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedBundle(null)}>
              Cancel
            </Button>
            <Button className="flex-1 gradient-primary border-0" onClick={handleAddToCart}>
              <ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
